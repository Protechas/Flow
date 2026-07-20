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
