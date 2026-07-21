import { describe, expect, it } from "vitest";
import { forecastUnitLabels, resolveProjectUnit, resolveTaskUnit } from "./units";

describe("forecast unit resolution", () => {
  it("project unit: own field beats team model default beats files", () => {
    expect(resolveProjectUnit({ forecast_unit: "lines" }, { forecastRules: { defaultUnit: "records" } })).toBe("lines");
    expect(resolveProjectUnit({ forecast_unit: null }, { forecastRules: { defaultUnit: "records" } })).toBe("records");
    expect(resolveProjectUnit({ forecast_unit: null }, { forecastRules: {} })).toBe("files");
    expect(resolveProjectUnit(null, null)).toBe("files");
  });

  it("task unit: own override beats the project unit", () => {
    expect(resolveTaskUnit({ forecast_unit: "VINs" }, "lines")).toBe("VINs");
    expect(resolveTaskUnit({ forecast_unit: null }, "lines")).toBe("lines");
    expect(resolveTaskUnit(null, "files")).toBe("files");
  });

  it("labels singularize known units and pass unknown ones through", () => {
    expect(forecastUnitLabels("lines")).toMatchObject({ plural: "lines", singular: "line" });
    expect(forecastUnitLabels(null)).toMatchObject({ plural: "files", singular: "file" });
    expect(forecastUnitLabels("widgets").plural).toBe("widgets");
  });
});
