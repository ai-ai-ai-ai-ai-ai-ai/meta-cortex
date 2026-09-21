# Kubernetes Runtime Boundary

Keep workloads inside the Kubernetes execution model. A Pod is a workload
boundary, not a place to recreate a host container runtime.

## Keep container execution inside the Pod contract

Use an ordinary Pod or Job image that already contains the workload's runtime
and tools. Do not start Docker, Podman, containerd, or another nested runtime in
the Pod, and do not invoke commands that create or manage sibling containers.

```yaml
# Prohibited: the workload recreates a container runtime in its Pod.
containers:
  - name: runner
    image: example/tools:stable
    command: ["dockerd"]
```

```yaml
# Preferred: the image directly runs the workload.
containers:
  - name: tests
    image: example/test-runner:stable
    command: ["/usr/local/bin/run-tests"]
```

The image names and command are illustrative. The project selects a pinned
image and its own workload command.

## Reject runtime sockets, host paths, and privilege

Do not mount Docker, Podman, containerd, CRI, or another host runtime socket.
Do not use a host path or privileged security context to recreate that runtime
boundary. Other host integrations and privileges require the consuming
project's explicit contract and security review.

```yaml
# Prohibited: a Pod receives a host runtime socket and privilege.
securityContext:
  privileged: true
volumeMounts:
  - name: runtime
    mountPath: /var/run/containerd/containerd.sock
volumes:
  - name: runtime
    hostPath:
      path: /var/run/containerd/containerd.sock
```

```yaml
# Preferred: the workload has no host runtime dependency.
containers:
  - name: worker
    image: example/worker:stable
    securityContext:
      allowPrivilegeEscalation: false
```

The preferred control is an example of a compatible posture, not a universal
replacement for the project's complete security policy.

## Keep build services as build services

A Pod may call an explicitly provided build service to build or export an
artifact when the project contract allows it. That API does not authorize
runtime commands such as `run`, `create`, `start`, or `exec` against a daemon.
The resulting image executes later as an ordinary Kubernetes workload.

## Validate the execution boundary

Render manifests before review and inspect containers, commands, volume mounts,
host paths, and security contexts. Search cluster scripts for nested-runtime
commands. Run the available Kubernetes schema validation or server-side dry run
when a cluster is available, and report those checks separately from runtime
behavior tests.

## Validation

- Check rendered Pod and Job manifests for nested runtime processes and commands.
- Check runtime socket mounts, host paths, and privileged contexts against the
  project's approved boundary.
- Check build-service clients for build/export-only operations.
- Run available schema or dry-run validation and report its exact result.
