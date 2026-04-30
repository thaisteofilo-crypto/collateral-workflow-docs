import { useEffect, useMemo, useState } from "react";
import { SEED_POSTS } from "../posts";

type Status = "todo" | "doing" | "review" | "approved" | "published";

interface Post {
  id: string;
  number: string;
  title: string;
  status: Status;
  feedback: string;
  updatedAt: number;
  startedAt?: number;
  finishedAt?: number;
}

function fmtDate(ts: number) {
  return new Date(ts).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
}

function tsToInput(ts?: number): string {
  if (!ts) return "";
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function inputToTs(value: string): number | undefined {
  if (!value) return undefined;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d, 12, 0, 0).getTime();
}

const STORAGE_KEY = "collateral.posts.v1";

const STATUS_OPTIONS: Array<{
  id: Status;
  label: string;
  color: string;
  bg: string;
  border: string;
}> = [
  {
    id: "todo",
    label: "A fazer",
    color: "var(--text-secondary)",
    bg: "rgba(160, 160, 160, 0.08)",
    border: "rgba(160, 160, 160, 0.2)",
  },
  {
    id: "doing",
    label: "Em produção",
    color: "#D6A461",
    bg: "rgba(214, 164, 97, 0.1)",
    border: "rgba(214, 164, 97, 0.3)",
  },
  {
    id: "review",
    label: "Aguardando aprovação",
    color: "#77C5D5",
    bg: "rgba(119, 197, 213, 0.1)",
    border: "rgba(119, 197, 213, 0.3)",
  },
  {
    id: "approved",
    label: "Aprovado",
    color: "#E2E99C",
    bg: "rgba(226, 233, 156, 0.1)",
    border: "rgba(226, 233, 156, 0.3)",
  },
  {
    id: "published",
    label: "Publicado",
    color: "#B596E5",
    bg: "rgba(181, 150, 229, 0.1)",
    border: "rgba(181, 150, 229, 0.3)",
  },
];

function loadPosts(): Post[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return SEED_POSTS.map((p, i) => ({
        id: `seed-${p.number}-${i}`,
        number: p.number,
        title: p.title,
        status: "todo" as Status,
        feedback: "",
        updatedAt: Date.now(),
      }));
    }
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function savePosts(posts: Post[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(posts));
  } catch {
    // ignore
  }
}

function moveStatus(current: Status, dir: -1 | 1): Status {
  const idx = STATUS_OPTIONS.findIndex((s) => s.id === current);
  const next = Math.max(0, Math.min(STATUS_OPTIONS.length - 1, idx + dir));
  return STATUS_OPTIONS[next].id;
}

export function Pipeline() {
  const [posts, setPosts] = useState<Post[]>(() => loadPosts());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);
  const [newNumber, setNewNumber] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<Status | null>(null);

  function handleDragStart(e: React.DragEvent, postId: string) {
    setDraggingId(postId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", postId);
  }

  function handleDragEnd() {
    setDraggingId(null);
    setDragOverCol(null);
  }

  function handleDragOver(e: React.DragEvent, col: Status) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverCol !== col) setDragOverCol(col);
  }

  function handleDragLeave(e: React.DragEvent, col: Status) {
    if (e.currentTarget === e.target) {
      if (dragOverCol === col) setDragOverCol(null);
    }
  }

  function handleDrop(e: React.DragEvent, col: Status) {
    e.preventDefault();
    const postId = e.dataTransfer.getData("text/plain") || draggingId;
    if (postId) {
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId && p.status !== col
            ? { ...p, status: col, updatedAt: Date.now() }
            : p
        )
      );
    }
    setDraggingId(null);
    setDragOverCol(null);
  }

  useEffect(() => {
    savePosts(posts);
  }, [posts]);

  const grouped = useMemo(() => {
    const map: Record<Status, Post[]> = {
      todo: [],
      doing: [],
      review: [],
      approved: [],
      published: [],
    };
    for (const p of posts) {
      map[p.status]?.push(p);
    }
    return map;
  }, [posts]);

  function updatePost(id: string, patch: Partial<Post>) {
    setPosts((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, ...patch, updatedAt: Date.now() } : p
      )
    );
  }

  function deletePost(id: string) {
    if (!confirm("Remover este post?")) return;
    setPosts((prev) => prev.filter((p) => p.id !== id));
  }

  function addPost(status: Status = "todo") {
    if (!newNumber.trim() || !newTitle.trim()) return;
    setPosts((prev) => [
      {
        id: `new-${Date.now()}`,
        number: newNumber.trim(),
        title: newTitle.trim(),
        status,
        feedback: "",
        updatedAt: Date.now(),
      },
      ...prev,
    ]);
    setNewNumber("");
    setNewTitle("");
    setAdding(false);
  }

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <span style={{ fontSize: 13, color: "var(--text-tertiary)" }}>
          {posts.length} {posts.length === 1 ? "post" : "posts"}
        </span>
        <button
          type="button"
          className="pill-button pill-button--primary"
          onClick={() => setAdding(!adding)}
        >
          {adding ? "Cancelar" : "+ Adicionar post"}
        </button>
      </div>

      {adding && (
        <div className="step-card" style={{ gap: 12 }}>
          <div
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <input
              type="text"
              className="pipeline-input"
              placeholder="Número"
              value={newNumber}
              onChange={(e) => setNewNumber(e.target.value)}
              style={{ width: 100 }}
            />
            <input
              type="text"
              className="pipeline-input"
              placeholder="Título do post"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              style={{ flex: 1, minWidth: 220 }}
            />
          </div>
          <button
            type="button"
            className="pill-button pill-button--primary"
            onClick={() => addPost()}
            style={{ alignSelf: "flex-start" }}
          >
            Salvar
          </button>
        </div>
      )}

      <div className="kanban">
        {STATUS_OPTIONS.map((status) => {
          const items = grouped[status.id];
          const isDragOver = dragOverCol === status.id;
          return (
            <div
              key={status.id}
              className={`kanban-column${isDragOver ? " is-drag-over" : ""}`}
              onDragOver={(e) => handleDragOver(e, status.id)}
              onDragLeave={(e) => handleDragLeave(e, status.id)}
              onDrop={(e) => handleDrop(e, status.id)}
            >
              <div
                className="kanban-column-header"
                style={{
                  background: status.bg,
                  borderColor: status.border,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span
                    className="kanban-dot"
                    style={{ background: status.color }}
                  />
                  <span style={{ color: status.color }}>{status.label}</span>
                </div>
                <span
                  className="kanban-count"
                  style={{ color: status.color }}
                >
                  {items.length}
                </span>
              </div>

              <div className="kanban-column-body">
                {items.length === 0 && (
                  <div className="kanban-empty">Sem posts</div>
                )}
                {items.map((post) => {
                  const isOpen = expanded.has(post.id);
                  const isFirst = status.id === STATUS_OPTIONS[0].id;
                  const isLast =
                    status.id ===
                    STATUS_OPTIONS[STATUS_OPTIONS.length - 1].id;
                  const isDragging = draggingId === post.id;
                  return (
                    <div
                      key={post.id}
                      className={`kanban-card${isDragging ? " is-dragging" : ""}`}
                      draggable
                      onDragStart={(e) => handleDragStart(e, post.id)}
                      onDragEnd={handleDragEnd}
                    >
                      <button
                        type="button"
                        className="kanban-card-main"
                        onClick={() => toggleExpand(post.id)}
                      >
                        <span className="kanban-card-number">
                          #{post.number}
                        </span>
                        <span className="kanban-card-title">{post.title}</span>
                        {(post.startedAt || post.finishedAt) && (
                          <span className="kanban-card-dates">
                            {post.startedAt && (
                              <span className="kanban-card-date">
                                <svg
                                  width="10"
                                  height="10"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2.5"
                                  strokeLinecap="round"
                                >
                                  <polyline points="5 12 12 5 19 12" />
                                </svg>
                                {fmtDate(post.startedAt)}
                              </span>
                            )}
                            {post.finishedAt && (
                              <span className="kanban-card-date kanban-card-date--done">
                                <svg
                                  width="10"
                                  height="10"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2.5"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <polyline points="5 12 10 17 19 8" />
                                </svg>
                                {fmtDate(post.finishedAt)}
                              </span>
                            )}
                          </span>
                        )}
                      </button>

                      {isOpen && (
                        <div className="kanban-card-detail">
                          <textarea
                            className="post-row-textarea"
                            placeholder="Notas, feedback do cliente, revisões..."
                            value={post.feedback}
                            onChange={(e) =>
                              updatePost(post.id, {
                                feedback: e.target.value,
                              })
                            }
                            rows={3}
                          />
                          <div className="kanban-card-date-fields">
                            <label className="kanban-date-field">
                              <span>Iniciado em</span>
                              <input
                                type="date"
                                value={tsToInput(post.startedAt)}
                                onChange={(e) =>
                                  updatePost(post.id, {
                                    startedAt: inputToTs(e.target.value),
                                  })
                                }
                              />
                            </label>
                            <label className="kanban-date-field">
                              <span>Concluído em</span>
                              <input
                                type="date"
                                value={tsToInput(post.finishedAt)}
                                onChange={(e) =>
                                  updatePost(post.id, {
                                    finishedAt: inputToTs(e.target.value),
                                  })
                                }
                              />
                            </label>
                          </div>
                          <span
                            style={{
                              fontSize: 11,
                              color: "var(--text-tertiary)",
                            }}
                          >
                            Atualizado{" "}
                            {new Date(post.updatedAt).toLocaleString("pt-BR")}
                          </span>
                        </div>
                      )}

                      <div className="kanban-card-actions">
                        <button
                          type="button"
                          className="kanban-card-arrow"
                          onClick={() =>
                            updatePost(post.id, {
                              status: moveStatus(post.status, -1),
                            })
                          }
                          disabled={isFirst}
                          aria-label="Mover para coluna anterior"
                          title="Mover para coluna anterior"
                        >
                          ‹
                        </button>
                        <button
                          type="button"
                          className="kanban-card-arrow"
                          onClick={() =>
                            updatePost(post.id, {
                              status: moveStatus(post.status, 1),
                            })
                          }
                          disabled={isLast}
                          aria-label="Mover para próxima coluna"
                          title="Mover para próxima coluna"
                        >
                          ›
                        </button>
                        <button
                          type="button"
                          className="kanban-card-delete"
                          onClick={() => deletePost(post.id)}
                          aria-label="Excluir post"
                          title="Excluir post"
                        >
                          <svg
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M3 6h18" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                            <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
