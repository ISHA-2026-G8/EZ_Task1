import { useMemo, useRef, useState } from 'react'

export type TreeNode = {
  id: string
  name: string
  children?: TreeNode[]
  hasChildren?: boolean
}

type TreeViewProps = {
  initialData?: TreeNode[]
}

const baseData: TreeNode[] = [
  {
    id: 'root-1',
    name: 'Product',
    hasChildren: true,
  },
  {
    id: 'root-2',
    name: 'Design',
    children: [
      { id: 'design-1', name: 'Wireframes' },
      { id: 'design-2', name: 'Brand', hasChildren: true },
    ],
  },
  {
    id: 'root-3',
    name: 'Engineering',
    children: [
      {
        id: 'eng-1',
        name: 'Frontend',
        children: [
          { id: 'eng-1-1', name: 'TreeView.tsx' },
          { id: 'eng-1-2', name: 'App.css' },
        ],
      },
      { id: 'eng-2', name: 'Backend' },
    ],
  },
]

const randomChildren = [
  'Roadmap',
  'Research',
  'Specs',
  'Notes',
  'Drafts',
  'Milestones',
  'Assets',
  'Archive',
]

const hasChildrenChance = () => Math.random() < 0.35

const findNode = (nodes: TreeNode[], id: string): TreeNode | undefined => {
  for (const node of nodes) {
    if (node.id === id) return node
    if (node.children) {
      const match = findNode(node.children, id)
      if (match) return match
    }
  }
  return undefined
}

const containsId = (node: TreeNode, id: string): boolean => {
  if (node.id === id) return true
  if (!node.children) return false
  return node.children.some((child) => containsId(child, id))
}

const updateNode = (
  nodes: TreeNode[],
  id: string,
  updater: (node: TreeNode) => TreeNode
): TreeNode[] =>
  nodes.map((node) => {
    if (node.id === id) return updater(node)
    if (!node.children) return node
    const updatedChildren = updateNode(node.children, id, updater)
    if (updatedChildren === node.children) return node
    return { ...node, children: updatedChildren }
  })

const removeNode = (
  nodes: TreeNode[],
  id: string
): { nodes: TreeNode[]; removed?: TreeNode } => {
  let removed: TreeNode | undefined

  const nextNodes: TreeNode[] = []
  for (const node of nodes) {
    if (node.id === id) {
      removed = node
      continue
    }
    if (node.children) {
      const result = removeNode(node.children, id)
      if (result.removed) {
        removed = result.removed
        const nextChildren = result.nodes
        nextNodes.push({
          ...node,
          children: nextChildren,
          hasChildren: nextChildren.length > 0,
        })
        continue
      }
    }
    nextNodes.push(node)
  }

  return { nodes: nextNodes, removed }
}

const insertNode = (
  nodes: TreeNode[],
  parentId: string | null,
  index: number,
  node: TreeNode
): TreeNode[] => {
  if (parentId === null) {
    const nextNodes = [...nodes]
    nextNodes.splice(index, 0, node)
    return nextNodes
  }

  return updateNode(nodes, parentId, (parent) => {
    const children = parent.children ? [...parent.children] : []
    children.splice(index, 0, node)
    return { ...parent, children, hasChildren: true }
  })
}

export const TreeView = ({ initialData = baseData }: TreeViewProps) => {
  const [treeData, setTreeData] = useState<TreeNode[]>(initialData)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingValue, setEditingValue] = useState('')
  const [addingParentId, setAddingParentId] = useState<string | null>(null)
  const [addingValue, setAddingValue] = useState('')
  const [draggingId, setDraggingId] = useState<string | null>(null)

  const idCounter = useRef(100)
  const lazyCache = useRef<Record<string, TreeNode[]>>({})

  const expandedArray = useMemo(() => Array.from(expandedIds), [expandedIds])

  const createId = () => {
    idCounter.current += 1
    return `node-${idCounter.current}`
  }

  const loadChildren = async (nodeId: string) => {
    if (loadingIds.has(nodeId)) return

    setLoadingIds((prev) => new Set(prev).add(nodeId))

    const cached = lazyCache.current[nodeId]
    if (cached) {
      await new Promise((resolve) => setTimeout(resolve, 400))
      setTreeData((prev) =>
        updateNode(prev, nodeId, (node) => ({
          ...node,
          children: cached,
          hasChildren: cached.length > 0,
        }))
      )
      setLoadingIds((prev) => {
        const next = new Set(prev)
        next.delete(nodeId)
        return next
      })
      return
    }

    const delay = 500 + Math.random() * 600
    const count = 2 + Math.floor(Math.random() * 3)
    const newChildren: TreeNode[] = Array.from({ length: count }, (_, index) => {
      const label = randomChildren[(index + Math.floor(Math.random() * 6)) % randomChildren.length]
      return {
        id: createId(),
        name: `${label}`,
        hasChildren: hasChildrenChance(),
      }
    })

    lazyCache.current[nodeId] = newChildren

    await new Promise((resolve) => setTimeout(resolve, delay))

    setTreeData((prev) =>
      updateNode(prev, nodeId, (node) => ({
        ...node,
        children: newChildren,
        hasChildren: newChildren.length > 0,
      }))
    )

    setLoadingIds((prev) => {
      const next = new Set(prev)
      next.delete(nodeId)
      return next
    })
  }

  const toggleNode = (nodeId: string, node: TreeNode) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(nodeId)) {
        next.delete(nodeId)
      } else {
        next.add(nodeId)
      }
      return next
    })

    if (!expandedIds.has(nodeId) && node.hasChildren && !node.children) {
      void loadChildren(nodeId)
    }
  }

  const startEdit = (node: TreeNode) => {
    setEditingId(node.id)
    setEditingValue(node.name)
  }

  const commitEdit = (nodeId: string) => {
    const value = editingValue.trim()
    if (!value) return

    setTreeData((prev) =>
      updateNode(prev, nodeId, (node) => ({
        ...node,
        name: value,
      }))
    )

    setEditingId(null)
    setEditingValue('')
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditingValue('')
  }

  const startAdd = (parentId: string) => {
    setAddingParentId(parentId)
    setAddingValue('')
    setExpandedIds((prev) => new Set(prev).add(parentId))
  }

  const commitAdd = (parentId: string) => {
    const value = addingValue.trim()
    if (!value) return

    const newNode: TreeNode = {
      id: createId(),
      name: value,
    }

    setTreeData((prev) =>
      updateNode(prev, parentId, (node) => {
        const children = node.children ? [...node.children, newNode] : [newNode]
        return {
          ...node,
          children,
          hasChildren: true,
        }
      })
    )

    setAddingParentId(null)
    setAddingValue('')
  }

  const cancelAdd = () => {
    setAddingParentId(null)
    setAddingValue('')
  }

  const deleteNode = (node: TreeNode) => {
    if (!window.confirm(`Delete "${node.name}" and its children?`)) return

    setTreeData((prev) => removeNode(prev, node.id).nodes)

    setExpandedIds((prev) => {
      const next = new Set(prev)
      next.delete(node.id)
      return next
    })
  }

  const handleDragStart = (nodeId: string) => (event: React.DragEvent) => {
    event.dataTransfer.setData('text/plain', nodeId)
    event.dataTransfer.effectAllowed = 'move'
    setDraggingId(nodeId)
  }

  const handleDragEnd = () => {
    setDraggingId(null)
  }

  const moveNode = (nodeId: string, parentId: string | null, index: number) => {
    setTreeData((prev) => {
      const draggedNode = findNode(prev, nodeId)
      if (!draggedNode) return prev

      if (parentId && containsId(draggedNode, parentId)) return prev

      const result = removeNode(prev, nodeId)
      if (!result.removed) return prev

      return insertNode(result.nodes, parentId, index, result.removed)
    })

    if (parentId) {
      setExpandedIds((prev) => new Set(prev).add(parentId))
    }
  }

  const handleDropZone = (parentId: string | null, index: number) =>
    (event: React.DragEvent) => {
      event.preventDefault()
      const nodeId = event.dataTransfer.getData('text/plain')
      if (!nodeId) return
      moveNode(nodeId, parentId, index)
    }

  const handleDropOnNode = (targetNode: TreeNode) => (event: React.DragEvent) => {
    event.preventDefault()
    const nodeId = event.dataTransfer.getData('text/plain')
    if (!nodeId || nodeId === targetNode.id) return
    const childCount = targetNode.children?.length ?? 0
    moveNode(nodeId, targetNode.id, childCount)
  }

  const renderDropZone = (parentId: string | null, index: number, depth: number) => (
    <div
      key={`drop-${parentId ?? 'root'}-${index}`}
      className="tree-drop-zone"
      style={{ paddingLeft: depth * 20 + 36 }}
      onDragOver={(event) => event.preventDefault()}
      onDrop={handleDropZone(parentId, index)}
    />
  )

  const renderNode = (node: TreeNode, depth: number) => {
    const isExpanded = expandedIds.has(node.id)
    const isLoading = loadingIds.has(node.id)
    const isEditing = editingId === node.id
    const hasChildren = (node.children && node.children.length > 0) || node.hasChildren

    return (
      <div key={node.id} className="tree-node-block">
        <div
          className={`tree-row ${draggingId === node.id ? 'is-dragging' : ''}`}
          style={{ paddingLeft: depth * 20 + 12 }}
          draggable
          onDragStart={handleDragStart(node.id)}
          onDragEnd={handleDragEnd}
          onDragOver={(event) => event.preventDefault()}
          onDrop={handleDropOnNode(node)}
        >
          <button
            type="button"
            className="tree-toggle"
            onClick={() => hasChildren && toggleNode(node.id, node)}
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
            disabled={!hasChildren}
          >
            {hasChildren ? (isExpanded ? '▾' : '▸') : '•'}
          </button>

          {isEditing ? (
            <input
              className="tree-edit-input"
              value={editingValue}
              onChange={(event) => setEditingValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') commitEdit(node.id)
                if (event.key === 'Escape') cancelEdit()
              }}
              autoFocus
            />
          ) : (
            <span
              className="tree-label"
              onDoubleClick={() => startEdit(node)}
            >
              {node.name}
            </span>
          )}

          {isLoading && <span className="tree-loading">Loading…</span>}

          <div className="tree-actions">
            {isEditing ? (
              <>
                <button type="button" onClick={() => commitEdit(node.id)}>
                  Save
                </button>
                <button type="button" onClick={cancelEdit}>
                  Cancel
                </button>
              </>
            ) : (
              <>
                <button type="button" onClick={() => startAdd(node.id)}>
                  + Add
                </button>
                <button type="button" onClick={() => startEdit(node)}>
                  Edit
                </button>
                <button type="button" onClick={() => deleteNode(node)}>
                  Delete
                </button>
              </>
            )}
          </div>
        </div>

        {addingParentId === node.id && (
          <div className="tree-add-row" style={{ paddingLeft: depth * 20 + 48 }}>
            <input
              className="tree-edit-input"
              placeholder="New node name"
              value={addingValue}
              onChange={(event) => setAddingValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') commitAdd(node.id)
                if (event.key === 'Escape') cancelAdd()
              }}
              autoFocus
            />
            <div className="tree-actions">
              <button type="button" onClick={() => commitAdd(node.id)}>
                Add
              </button>
              <button type="button" onClick={cancelAdd}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {isExpanded && node.children && (
          <div className="tree-children">
            {renderDropZone(node.id, 0, depth + 1)}
            {node.children.map((child, childIndex) => (
              <div key={child.id}>
                {renderNode(child, depth + 1)}
                {renderDropZone(node.id, childIndex + 1, depth + 1)}
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <section className="tree-view">
      <header className="tree-header">
        <div>
          <h1>Tree View</h1>
          <p>Drag nodes to reorder or move them. Double-click a name to edit.</p>
        </div>
        <div className="tree-status">
          <span>{treeData.length} roots</span>
          <span>{expandedArray.length} expanded</span>
        </div>
      </header>

      <div className="tree-panel">
        {renderDropZone(null, 0, 0)}
        {treeData.map((node, index) => (
          <div key={node.id}>
            {renderNode(node, 0)}
            {renderDropZone(null, index + 1, 0)}
          </div>
        ))}
      </div>
    </section>
  )
}

export default TreeView
