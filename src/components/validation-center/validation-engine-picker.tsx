import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getActiveValidationEngines, VALIDATION_ENGINES } from "@/lib/validation-center/engines/registry";

export function ValidationEnginePicker() {
  const activeEngines = getActiveValidationEngines();
  const upcomingEngines = VALIDATION_ENGINES.filter((e) => e.status !== "active");

  return (
    <div className="space-y-8">
      <section>
        <h2 className="text-sm font-semibold text-foreground mb-3">Available engines</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {activeEngines.map((engine) => (
            <Card key={engine.id} className="border-border/70">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base">{engine.label}</CardTitle>
                  <Badge variant="secondary">Active</Badge>
                </div>
                <CardDescription>{engine.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button render={<Link href={`/validation/new?engine=${engine.id}`} />}>
                  Start {engine.label}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {upcomingEngines.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-muted-foreground mb-3">Planned engines</h2>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {upcomingEngines.map((engine) => (
              <Card key={engine.id} className="border-dashed border-border/50 bg-muted/20">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-sm">{engine.label}</CardTitle>
                    <Badge variant="outline" className="capitalize">
                      {engine.status}
                    </Badge>
                  </div>
                  <CardDescription className="text-xs">{engine.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
