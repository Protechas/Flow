import { beforeEach, describe, expect, it } from "vitest";
import {
  addTodo,
  deleteTodo,
  listTodos,
  moveTodo,
  replaceTodoMemoryState,
  setTodoStatus,
} from "./todos";

// Demo/in-memory mode (no Supabase configured in tests) — same code paths the
// panel and Eddy's tools use.

beforeEach(() => {
  replaceTodoMemoryState([]);
});

describe("user todos", () => {
  it("adds and lists per user, isolated", async () => {
    await addTodo("u1", { title: "Call Mark about ID3 spec", source: "eddy" });
    await addTodo("u1", { title: "Review Kia batch" });
    await addTodo("u2", { title: "Someone else's item" });

    const mine = await listTodos("u1");
    expect(mine.map((t) => t.title)).toEqual([
      "Call Mark about ID3 spec",
      "Review Kia batch",
    ]);
    expect(mine[0].source).toBe("eddy");
    expect(await listTodos("u2")).toHaveLength(1);
  });

  it("completes items and hides them from the open list", async () => {
    const a = await addTodo("u1", { title: "A" });
    await addTodo("u1", { title: "B" });
    const done = await setTodoStatus("u1", a.id, "done");
    expect(done?.status).toBe("done");
    expect(done?.completed_at).toBeTruthy();
    expect((await listTodos("u1")).map((t) => t.title)).toEqual(["B"]);
    expect((await listTodos("u1", { includeDone: true }))).toHaveLength(2);
  });

  it("never lets one user touch another's items", async () => {
    const a = await addTodo("u1", { title: "Mine" });
    expect(await setTodoStatus("u2", a.id, "done")).toBeNull();
    await deleteTodo("u2", a.id);
    expect(await listTodos("u1")).toHaveLength(1);
  });

  it("reorders with up/down and clamps at the edges", async () => {
    const a = await addTodo("u1", { title: "A" });
    await addTodo("u1", { title: "B" });
    await addTodo("u1", { title: "C" });

    await moveTodo("u1", a.id, "down");
    expect((await listTodos("u1")).map((t) => t.title)).toEqual(["B", "A", "C"]);

    await moveTodo("u1", a.id, "down");
    expect((await listTodos("u1")).map((t) => t.title)).toEqual(["B", "C", "A"]);

    await moveTodo("u1", a.id, "down"); // already last — no-op
    expect((await listTodos("u1")).map((t) => t.title)).toEqual(["B", "C", "A"]);

    await moveTodo("u1", a.id, "up");
    await moveTodo("u1", a.id, "up");
    await moveTodo("u1", a.id, "up"); // already first — no-op
    expect((await listTodos("u1")).map((t) => t.title)).toEqual(["A", "B", "C"]);
  });

  it("rejects empty titles and caps length", async () => {
    await expect(addTodo("u1", { title: "   " })).rejects.toThrow();
    const long = await addTodo("u1", { title: "x".repeat(500) });
    expect(long.title.length).toBe(300);
  });
});
