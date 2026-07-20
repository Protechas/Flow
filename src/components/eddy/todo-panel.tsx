"use client";

import { useEffect, useState, useTransition } from "react";
import {
  addMyTodoAction,
  deleteMyTodoAction,
  listMyTodosAction,
  moveMyTodoAction,
  setMyTodoStatusAction,
} from "@/app/actions/todos";
import { AI_NAME } from "@/lib/ai/brand";
import type { UserTodo } from "@/lib/eddy/todos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ArrowDown, ArrowUp, Loader2, Plus, Sparkles, Trash2 } from "lucide-react";

/**
 * The My List tab in the Eddy panel — the same list Eddy keeps through chat
 * ("add X to my list"). Strictly the signed-in user's own items.
 */
export function TodoPanel() {
  const [todos, setTodos] = useState<UserTodo[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (loaded) return;
    startTransition(async () => {
      const res = await listMyTodosAction();
      if (res.ok) setTodos(res.todos);
      else setError(res.message ?? null);
      setLoaded(true);
    });
  }, [loaded]);

  function apply(res: { ok: boolean; todos: UserTodo[]; message?: string }) {
    if (res.ok) {
      setTodos(res.todos);
      setError(null);
    } else {
      setError(res.message ?? "Something went wrong");
    }
  }

  function add() {
    const title = draft.trim();
    if (!title) return;
    setDraft("");
    startTransition(async () => apply(await addMyTodoAction({ title })));
  }

  return (
    <div className="space-y-3">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add an item…"
        />
        <Button type="submit" size="icon" disabled={pending || !draft.trim()} aria-label="Add to-do">
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        </Button>
      </form>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {loaded && todos.length === 0 && !pending ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Nothing on your list. Add items here, or just tell {AI_NAME}{" "}
          <em>&quot;add … to my list&quot;</em> in chat.
        </p>
      ) : (
        <ul className="max-h-80 space-y-1.5 overflow-y-auto pr-1">
          {todos.map((todo, i) => (
            <li
              key={todo.id}
              className="group flex items-start gap-2 rounded-md border border-border/50 bg-muted/10 px-3 py-2"
            >
              <input
                type="checkbox"
                className="mt-1"
                checked={false}
                aria-label={`Mark "${todo.title}" done`}
                onChange={() =>
                  startTransition(async () =>
                    apply(await setMyTodoStatusAction({ todoId: todo.id, status: "done" }))
                  )
                }
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm">{todo.title}</p>
                {todo.context && (
                  <p className="text-xs text-muted-foreground">{todo.context}</p>
                )}
                {todo.source === "eddy" && (
                  <p className="mt-0.5 inline-flex items-center gap-1 text-[10px] text-primary/80">
                    <Sparkles className="h-2.5 w-2.5" />
                    added via {AI_NAME}
                  </p>
                )}
              </div>
              <span
                className={cn(
                  "flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity",
                  "group-hover:opacity-100 focus-within:opacity-100"
                )}
              >
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  disabled={pending || i === 0}
                  aria-label="Move up"
                  onClick={() =>
                    startTransition(async () =>
                      apply(await moveMyTodoAction({ todoId: todo.id, direction: "up" }))
                    )
                  }
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  disabled={pending || i === todos.length - 1}
                  aria-label="Move down"
                  onClick={() =>
                    startTransition(async () =>
                      apply(await moveMyTodoAction({ todoId: todo.id, direction: "down" }))
                    )
                  }
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-muted-foreground hover:text-destructive"
                  disabled={pending}
                  aria-label="Delete"
                  onClick={() =>
                    startTransition(async () =>
                      apply(await deleteMyTodoAction({ todoId: todo.id }))
                    )
                  }
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
