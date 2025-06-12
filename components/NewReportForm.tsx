'use client';

import React, { useEffect, useState } from 'react';
import { subMonths, subYears } from 'date-fns';

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

    const to = new Date();
    let from = to;

    switch (value) {
      case '1y':
        from = subYears(to, 1);
        break;
      case '6m':
        from = subMonths(to, 6);
        break;
      case '3m':
        from = subMonths(to, 3);
        break;
      case '1m':
        from = subMonths(to, 1);
        break;
      case 'custom':
        return;
    }

    console.log('Setting date range:', from, to);
    setDate({ from, to });
  }


  // handle form submission
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const id = uuidv4();

    if (file) {
      const reader = new FileReader();

      reader.onload = async () => {
        try {
          const raw = reader.result as string;
          let json;
          console.log('Raw file content:', raw);

          const convertToJSONString = (ndjson) => {
            try {
              const lines = ndjson.trim().split('\n');
              const jsonObjects = lines.map(line => JSON.parse(line));
              json = JSON.stringify(jsonObjects);
              console.log('Parsed JSON:', json);
            } catch (err) {
              console.error('Error parsing NDJSON:', err);
            }
          }

          json = await convertToJSONString(raw);

          const report = {
            id,
            title,
            timespan: date,
            fileName: file.name,
            fileContent: json,
            createdAt: new Date().toISOString(),
          };

          const stored = localStorage.getItem('reports');
          const reports = stored ? JSON.parse(stored) : [];

          reports.push(report);
          localStorage.setItem('reports', JSON.stringify(reports));

          router.push(`/report?id=${id}`);
        } catch (err) {
          console.error('Invalid JSON or NDJSON file:', err);
          alert("Invalid JSON or NDJSON file.");
        }
      };

      reader.readAsText(file);
    } else {
      const report = {
        id,
        title,
        timespan: date,
        fileName: null,
        fileContent: null,
        createdAt: new Date().toISOString(),
      };

      const stored = localStorage.getItem('reports');
      const reports = stored ? JSON.parse(stored) : [];

      reports.push(report);
      localStorage.setItem('reports', JSON.stringify(reports));

      router.push(`/report?id=${id}`);
    }
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
        <Label htmlFor="extra-sources">Additional Sources (as NDJSON!)</Label>
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
