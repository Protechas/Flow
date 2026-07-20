"use server";

import { requireUser } from "@/lib/auth/session";
import {
  addTodo,
  deleteTodo,
  listTodos,
  moveTodo,
  setTodoStatus,
  type UserTodo,
} from "@/lib/eddy/todos";

/**
 * Personal to-do list actions — every call is scoped to the signed-in user;
 * there is no way to address anyone else's list from here.
 */

export interface TodoListResult {
  ok: boolean;
  todos: UserTodo[];
  message?: string;
}

async function ownList(userId: string, includeDone: boolean): Promise<UserTodo[]> {
  return listTodos(userId, { includeDone });
}

export async function listMyTodosAction(input?: {
  includeDone?: boolean;
}): Promise<TodoListResult> {
  const user = await requireUser();
  try {
    return { ok: true, todos: await ownList(user.id, Boolean(input?.includeDone)) };
  } catch (e) {
    return { ok: false, todos: [], message: e instanceof Error ? e.message : "Could not load your list" };
  }
}

export async function addMyTodoAction(input: {
  title: string;
  context?: string;
}): Promise<TodoListResult> {
  const user = await requireUser();
  try {
    await addTodo(user.id, { title: input.title, context: input.context, source: "manual" });
    return { ok: true, todos: await ownList(user.id, false) };
  } catch (e) {
    return { ok: false, todos: [], message: e instanceof Error ? e.message : "Could not add that" };
  }
}

export async function setMyTodoStatusAction(input: {
  todoId: string;
  status: "open" | "done";
}): Promise<TodoListResult> {
  const user = await requireUser();
  try {
    await setTodoStatus(user.id, input.todoId, input.status);
    return { ok: true, todos: await ownList(user.id, false) };
  } catch (e) {
    return { ok: false, todos: [], message: e instanceof Error ? e.message : "Could not update that" };
  }
}

export async function deleteMyTodoAction(input: { todoId: string }): Promise<TodoListResult> {
  const user = await requireUser();
  try {
    await deleteTodo(user.id, input.todoId);
    return { ok: true, todos: await ownList(user.id, false) };
  } catch (e) {
    return { ok: false, todos: [], message: e instanceof Error ? e.message : "Could not delete that" };
  }
}

export async function moveMyTodoAction(input: {
  todoId: string;
  direction: "up" | "down";
}): Promise<TodoListResult> {
  const user = await requireUser();
  try {
    await moveTodo(user.id, input.todoId, input.direction);
    return { ok: true, todos: await ownList(user.id, false) };
  } catch (e) {
    return { ok: false, todos: [], message: e instanceof Error ? e.message : "Could not move that" };
  }
}
