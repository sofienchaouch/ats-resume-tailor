// RFC 5545 escaping: commas, semicolons, newlines, backslashes.
export function icsEscape(text: string): string {
  return (text || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

function toIcsUtc(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

export interface InterviewEventInput {
  company: string;
  role: string;
  type: string;
  date: string; // YYYY-MM-DD
  time: string; // free text, best-effort HH:MM extraction
  link?: string;
  notes?: string;
}

/** Builds an RFC 5545 .ics file body (CRLF line endings) for a single interview event. */
export function buildInterviewIcs(input: InterviewEventInput, now: Date = new Date()): string {
  let cleanTime = '10:00';
  const timeMatch = input.time.match(/([0-1]?[0-9]|2[0-3]):[0-5][0-9]/);
  if (timeMatch) {
    cleanTime = timeMatch[0];
  }

  const startDate = new Date(`${input.date}T${cleanTime}:00`);
  const finalStartDate = isNaN(startDate.getTime()) ? now : startDate;
  const finalEndDate = new Date(finalStartDate.getTime() + 60 * 60 * 1000);

  const description = `Scheduled via ATS Resume Tailor.\n\nType: ${input.type}\nMeeting Link: ${input.link || 'None'}\n\nAdditional Notes:\n${input.notes || ''}`;

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ATS Resume Tailor//Interview Scheduler//EN',
    'BEGIN:VEVENT',
    `UID:${now.getTime()}-${Math.random().toString(36).substr(2, 9)}@ats-resume-tailor`,
    `DTSTAMP:${toIcsUtc(now)}`,
    `DTSTART:${toIcsUtc(finalStartDate)}`,
    `DTEND:${toIcsUtc(finalEndDate)}`,
    `SUMMARY:${icsEscape(`Interview: ${input.company} - ${input.role} (${input.type})`)}`,
    `LOCATION:${icsEscape(input.link || 'Virtual Meeting')}`,
    `DESCRIPTION:${icsEscape(description)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  return lines.join('\r\n');
}
