import {
  manufacturerRollup,
  projectRollup,
  yearRollup,
} from "@/lib/hierarchy/rollups";
import type {
  ActivityEvent,
  Manufacturer,
  OperationsTree,
  Project,
  QaReview,
  WorkPackage,
  YearWorkItem,
} from "@/types/flow";

export function buildOperationsTree(
  projects: Project[],
  manufacturers: Manufacturer[],
  yearItems: YearWorkItem[],
  packages: WorkPackage[],
  qaReviews: QaReview[],
  activity: ActivityEvent[] = []
): OperationsTree {
  return {
    projects: projects.map((project) => {
      const projectPkgs = packages.filter((p) => p.project_id === project.id);
      const projectYears = yearItems.filter((y) => y.project_id === project.id);
      const projectMfrs = manufacturers.filter((m) => m.project_id === project.id);

      return {
        project,
        rollup: projectRollup(project, projectPkgs, manufacturers, qaReviews, projectYears, activity),
        manufacturers: projectMfrs.map((mfr) => {
          const mfrPkgs = projectPkgs.filter((p) => p.manufacturer_id === mfr.id);
          const mfrYears = projectYears
            .filter((y) => y.manufacturer_id === mfr.id)
            .sort((a, b) => b.year - a.year);

          return {
            manufacturer: mfr,
            rollup: manufacturerRollup(mfr, mfrPkgs, qaReviews, mfrYears, activity),
            years: mfrYears.map((yearItem) => {
              const yearPkgs = mfrPkgs.filter((p) => p.year_work_item_id === yearItem.id);
              return {
                yearWorkItem: yearItem,
                rollup: yearRollup(yearItem, yearPkgs, qaReviews, activity),
                packages: yearPkgs,
              };
            }),
          };
        }),
      };
    }),
  };
}
