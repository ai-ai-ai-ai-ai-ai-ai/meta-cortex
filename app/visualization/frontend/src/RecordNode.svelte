<script lang="ts">
  import { Handle, Position } from "@xyflow/svelte";
  import type { NodeProps } from "@xyflow/svelte";
  import type { DiagramNode } from "./workflow";
  let { data }: NodeProps<DiagramNode> = $props();
</script>

<div class="workflow-node" data-state={data.state}>
  <Handle type="target" position={Position.Top} />
  <span class="node-kind">{data.kind}</span>
  <strong>{data.title}</strong>
  <p>{data.subtitle}</p>
  <div class="node-footer">
    <span>{data.state}</span><span>{data.tasks.length} tasks</span>
  </div>
  <Handle type="source" position={Position.Bottom} />
</div>
