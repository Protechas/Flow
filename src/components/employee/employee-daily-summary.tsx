import type { EmployeeDailySummary, PayType } from "@/types/flow";

import { formatMinutes } from "@/lib/production/metrics";

import { requiresShiftClock } from "@/lib/users/pay-type";

import { CheckCircle2, Clock, FileText, RotateCcw, Shield } from "lucide-react";



export function EmployeeDailySummaryBar({

  summary,

  payType = "hourly",

}: {

  summary: EmployeeDailySummary;

  payType?: PayType;

}) {

  const useShiftClock = requiresShiftClock({ role: "employee", pay_type: payType });

  const timeValue = useShiftClock

    ? summary.shiftMinutesToday != null

      ? formatMinutes(summary.shiftMinutesToday)

      : "—"

    : summary.hoursWorkedToday > 0

      ? `${summary.hoursWorkedToday}h`

      : "—";



  const items = [

    { label: "Completed", value: summary.tasksCompletedToday, icon: CheckCircle2 },

    {

      label: useShiftClock ? "Shift time" : "Task time",

      value: timeValue,

      icon: Clock,

    },

    { label: "Files", value: summary.documentsUploadedToday, icon: FileText },

    { label: "QA passes", value: summary.qaPasses, icon: Shield },

    { label: "Corrections", value: summary.correctionsReceived, icon: RotateCcw },

  ];



  return (

    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">

      {items.map((item) => (

        <div key={item.label} className="enterprise-panel px-3 py-2.5 text-center">

          <item.icon className="h-3.5 w-3.5 mx-auto mb-1 text-muted-foreground" />

          <p className="text-lg font-semibold tabular-nums leading-none">{item.value}</p>

          <p className="enterprise-label mt-1 normal-case tracking-normal text-[10px]">

            {item.label}

          </p>

        </div>

      ))}

    </div>

  );

}

