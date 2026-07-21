import { describe, expect, it } from "vitest";
import {
  EMPTY_OPERATING_MODEL_INPUT,
  inputToModel,
  modelToFormInput,
} from "./form";

describe("operating model form — content checks toggle", () => {
  it("defaults ON for new models", () => {
    expect(EMPTY_OPERATING_MODEL_INPUT.contentChecksEnabled).toBe(true);
    const model = inputToModel({ ...EMPTY_OPERATING_MODEL_INPUT, slug: "x", label: "X" });
    expect(model.contentChecksEnabled).toBe(true);
  });

  it("round-trips an explicit opt-out", () => {
    const model = inputToModel({
      ...EMPTY_OPERATING_MODEL_INPUT,
      slug: "id3",
      label: "ID3",
      contentChecksEnabled: false,
    });
    expect(model.contentChecksEnabled).toBe(false);
    expect(modelToFormInput(model).contentChecksEnabled).toBe(false);
  });

  it("treats legacy models without the flag as ON", () => {
    const model = inputToModel({ ...EMPTY_OPERATING_MODEL_INPUT, slug: "y", label: "Y" });
    delete (model as { contentChecksEnabled?: boolean }).contentChecksEnabled;
    expect(modelToFormInput(model).contentChecksEnabled).toBe(true);
  });
});

describe("operating model form — upload gate", () => {
  it("defaults to enabled at 30 minutes for new models", () => {
    expect(EMPTY_OPERATING_MODEL_INPUT.uploadGateEnabled).toBe(true);
    expect(EMPTY_OPERATING_MODEL_INPUT.uploadGateMinMinutes).toBe(30);
    const model = inputToModel({ ...EMPTY_OPERATING_MODEL_INPUT, slug: "x", label: "X" });
    expect(model.uploadGate).toEqual({ enabled: true, minTimedMinutes: 30 });
  });

  it("round-trips a custom threshold and an off switch", () => {
    const model = inputToModel({
      ...EMPTY_OPERATING_MODEL_INPUT,
      slug: "email",
      label: "Email",
      uploadGateEnabled: false,
      uploadGateMinMinutes: 45,
    });
    expect(model.uploadGate).toEqual({ enabled: false, minTimedMinutes: 45 });
    const form = modelToFormInput(model);
    expect(form.uploadGateEnabled).toBe(false);
    expect(form.uploadGateMinMinutes).toBe(45);
  });

  it("treats legacy models without the gate as enabled at 30", () => {
    const model = inputToModel({ ...EMPTY_OPERATING_MODEL_INPUT, slug: "y", label: "Y" });
    delete (model as { uploadGate?: unknown }).uploadGate;
    const form = modelToFormInput(model);
    expect(form.uploadGateEnabled).toBe(true);
    expect(form.uploadGateMinMinutes).toBe(30);
  });
});
