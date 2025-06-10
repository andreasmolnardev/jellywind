"use client";
import { useEffect, useState } from "react";
import ReportCardComponent from "./ReportCard";

type Report = {
  id: string;
  title: string;
  timespan: {
    from: string;
    to: string;
  };
};

export default function ReportsList() {
  const [reports, setReports] = useState<Report[]>([]);

  useEffect(() => {
    const reports = JSON.parse(localStorage.getItem("reports") || "[]");
    setReports(reports);
  }, []);

  return (
    <>
      {reports.map((report, index) => (
        <ReportCardComponent key={index}
        id={report.id}
          title={report.title}
          timespan={`${new Date(report.timespan.from).toLocaleDateString()} - ${new Date(report.timespan.to).toLocaleDateString()}`}
        />
      ))}
    </>
  );
}
