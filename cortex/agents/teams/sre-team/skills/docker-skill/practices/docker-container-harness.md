# Docker Container and BuildKit Practice

Use Docker and BuildKit as the source of truth for container layer reuse. Keep
build inputs explicit, keep revision identity late, and verify cache behavior
with real solves.

## Isolate build inputs

Each stage should receive only files that can affect its output. This keeps
dependency layers reusable and prevents one compiler or package domain from
silently becoming input to another.

```dockerfile
# Prohibited: the whole checkout invalidates every later layer.
COPY . /workspace
RUN make dependencies
```

```dockerfile
# Preferred: stable dependency inputs are copied before source inputs.
COPY package.json package-lock.json ./
RUN npm ci
COPY src/ ./src/
RUN npm run build
```

The fragment is illustrative: replace the manifest and commands with the
project's actual build contract. The rule applies to every stage, including
tests and artifact packaging.

## Introduce build identity at its consumer

Commit, release, or provenance identity belongs at the latest boundary that
needs it. Do not place an identity argument before dependency installation or
other work whose result does not depend on that identity.

```dockerfile
FROM example/base:stable AS build
WORKDIR /workspace
COPY package.json package-lock.json ./
RUN npm ci
COPY src/ ./src/
RUN npm run build

# This stage alone consumes the revision for metadata.
FROM scratch AS image
COPY --from=build /workspace/dist /dist
ARG BUILD_REVISION
LABEL org.opencontainers.image.revision=$BUILD_REVISION
```

The label is an example of a late consumer. A project may use a different
metadata or artifact contract.

## Let BuildKit own cache validity

BuildKit determines layer validity from the Dockerfile, build context, build
arguments, and base image. Preserve genuine `cache-from` and `cache-to`
configuration, but do not duplicate that decision with dependency hashes,
manual selectors, allowlists, or source-mutation simulations.

```text
# Prohibited: a script predicts a hit with a second cache-key algorithm.
cache_ref="build-cache-${dependency_fingerprint}"

# Preferred: provide cache sources and let BuildKit solve the graph.
docker buildx build --cache-from type=registry,ref=example/app:buildcache .
```

The commands are inert examples; use the consuming project's configured
builder and cache store.

## Prove cold, warm, import, and export builds

Cache claims require actual BuildKit solves. A useful evidence set contains:

1. a cold build with an empty cache source;
2. a warm replay using the exported local or remote cache;
3. an import build on a clean builder or cache store; and
4. an export build whose cache artifact is inspected after completion.

Capture the command, exit status, BuildKit output, cache hit or miss summary
when available, and the existence and readable metadata of exported artifacts.
Do not replace a solve with a mock, static counter, or source-mutation
prediction.

```sh
# Illustrative local evidence sequence; the project chooses the paths.
docker buildx build --progress=plain --file Dockerfile \
  --cache-to type=local,dest=.cache/export,mode=max .
docker buildx build --progress=plain --file Dockerfile \
  --cache-from type=local,src=.cache/export \
  --cache-to type=local,dest=.cache/reexport,mode=max .
```

The preferred evidence still needs a clean import solve when the project claims
portability across builders. A successful command alone does not prove that
the cache artifact was exported or reusable.

## Keep secrets out of build inputs

Secrets must not appear in build arguments, environment values, build contexts,
layers, cache keys, logs, or image metadata. When a build step needs a secret,
use the narrow BuildKit secret interface and ensure the command does not copy it
into a layer or output.

```dockerfile
# Prohibited: the value becomes part of the build definition or image history.
ARG PACKAGE_TOKEN
RUN curl -H "Authorization: Bearer $PACKAGE_TOKEN" https://packages.example.invalid
```

```dockerfile
# Preferred: the secret is mounted only for the command that needs it.
RUN --mount=type=secret,id=package_token \
    sh -c 'curl -H "Authorization: Bearer $(cat /run/secrets/package_token)" https://packages.example.invalid'
```

The endpoint and secret identifier are hypothetical. The project still owns
authorization, source trust, and whether a private dependency is appropriate.

## Validation

- Review every stage's `COPY`, `ADD`, build argument, and output boundary.
- Run the project's Dockerfile syntax or BuildKit checks.
- Capture real cold, warm, import, and export evidence when cache behavior changes.
- Inspect exported cache artifacts rather than treating a zero exit status as proof.
- Review logs and metadata for accidental secret disclosure.
