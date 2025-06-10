'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { addDays } from 'date-fns';
import { Label } from '@radix-ui/react-label';
import { Input } from './ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Button } from './ui/button';
const { v4: uuidv4 } = require('uuid');

export default function NewReportForm() {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('jellyfin_token');
    if (!token) {
      router.push('/auth');
    }
  }, [router]);

  const [date, setDate] = useState<{ from: Date; to: Date } | undefined>({
    from: new Date(),
    to: addDays(new Date(), 20),
  });
  const [tabValue, setTabValue] = useState<string>('1y');
  const [title, setTitle] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);

  // handle tab change
  function handleTabChange(value: string) {
    setTabValue(value);
  }

  // handle form submission
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const id = uuidv4();
    const report = {
      id,
      title,
      timespan: tabValue === 'custom' ? date : { preset: tabValue },
      fileName: file?.name || null,
      createdAt: new Date().toISOString(),
    };

    // fetch existing reports
    const stored = localStorage.getItem('reports');
    const reports = stored ? JSON.parse(stored) : [];

    // add and store
    reports.push(report);
    localStorage.setItem('reports', JSON.stringify(reports));

    // redirect to report page
    router.push(`/report?reportId=${id}`);
  }

  return (
    <form
      className="flex flex-col gap-3 items-center"
      onSubmit={handleSubmit}
    >
      {/* Title input */}
      <div className="grid w-full max-w-sm items-center gap-1">
        <Label htmlFor="report-title">Title</Label>
        <Input
          type="text"
          name="report-title"
          id="report-title"
          placeholder="e.g. Year in review"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      {/* Timespan tabs */}
      <div className="grid w-full max-w-sm items-center gap-1">
        <Label>Timespan</Label>
        <Tabs
          value={tabValue}
          onValueChange={handleTabChange}
          className="w-[400px]"
        >
          <TabsList>
            <TabsTrigger value="1y">1y</TabsTrigger>
            <TabsTrigger value="6m">6m</TabsTrigger>
            <TabsTrigger value="3m">3m</TabsTrigger>
            <TabsTrigger value="1m">1m</TabsTrigger>
            <TabsTrigger value="custom">Custom</TabsTrigger>
          </TabsList>

          <TabsContent value="custom">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="date"
                  variant="outline"
                  className="w-full justify-start text-left font-normal"
                >
                  {date?.from && date.to
                    ? `${date.from.toLocaleDateString()} - ${date.to.toLocaleDateString()}`
                    : 'Pick a date range'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={date?.from}
                  selected={date}
                  onSelect={(range) => setDate(range as { from: Date; to: Date })}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>
          </TabsContent>
        </Tabs>
      </div>

      {/* Additional sources */}
      <div className="grid w-full max-w-sm items-center gap-1">
        <Label htmlFor="extra-sources">Additional Sources</Label>
        <Input
          id="extra-sources"
          type="file"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />
      </div>

      <Button type="submit">Submit</Button>
    </form>
  );
}
