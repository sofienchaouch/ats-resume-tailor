import { describe, it, expect } from "vitest";
import { buildInterviewIcs, icsEscape } from "./ics";

describe("icsEscape", () => {
  it("escapes commas, semicolons, newlines, and backslashes", () => {
    expect(icsEscape("a,b;c\nd\\e")).toBe("a\\,b\\;c\\nd\\\\e");
  });

  it("handles empty/undefined input", () => {
    expect(icsEscape("")).toBe("");
  });
});

describe("buildInterviewIcs", () => {
  const now = new Date("2026-01-15T12:00:00.000Z");

  it("produces a valid VCALENDAR/VEVENT structure with CRLF line endings", () => {
    const ics = buildInterviewIcs(
      { company: "Acme", role: "Engineer", type: "Technical Interview", date: "2026-02-01", time: "14:30", link: "https://meet.example.com", notes: "Bring laptop" },
      now
    );

    expect(ics).toContain("BEGIN:VCALENDAR\r\n");
    expect(ics).toContain("BEGIN:VEVENT\r\n");
    expect(ics).toContain("END:VEVENT\r\n");
    expect(ics).toContain("END:VCALENDAR");
    expect(ics).toContain("SUMMARY:Interview: Acme - Engineer (Technical Interview)");
    expect(ics).toContain("LOCATION:https://meet.example.com");
  });

  // Date-time strings with no timezone suffix parse as local time, so the
  // expected UTC instant is computed the same way the function computes it
  // (rather than hardcoded), keeping the test valid in any timezone.
  const expectedIcsUtc = (localDateTimeStr: string) =>
    new Date(localDateTimeStr).toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

  it("extracts a valid HH:MM time and offsets DTEND by exactly one hour", () => {
    const ics = buildInterviewIcs({ company: "A", role: "R", type: "T", date: "2026-03-10", time: "09:15", notes: "" }, now);
    expect(ics).toContain(`DTSTART:${expectedIcsUtc("2026-03-10T09:15:00")}`);
    expect(ics).toContain(`DTEND:${expectedIcsUtc("2026-03-10T10:15:00")}`);
  });

  it("falls back to 10:00 when the time field has no recognizable HH:MM", () => {
    const ics = buildInterviewIcs({ company: "A", role: "R", type: "T", date: "2026-03-10", time: "sometime afternoon", notes: "" }, now);
    expect(ics).toContain(`DTSTART:${expectedIcsUtc("2026-03-10T10:00:00")}`);
  });

  it("falls back to `now` when the date is unparseable", () => {
    const ics = buildInterviewIcs({ company: "A", role: "R", type: "T", date: "not-a-date", time: "10:00", notes: "" }, now);
    expect(ics).toContain(`DTSTART:${now.toISOString().replace(/[-:]/g, "").split(".")[0]}Z`);
  });

  it("uses 'Virtual Meeting' as the location when no link is given", () => {
    const ics = buildInterviewIcs({ company: "A", role: "R", type: "T", date: "2026-03-10", time: "10:00" }, now);
    expect(ics).toContain("LOCATION:Virtual Meeting");
  });

  it("escapes commas in company/role names within SUMMARY", () => {
    const ics = buildInterviewIcs({ company: "Acme, Inc.", role: "R", type: "T", date: "2026-03-10", time: "10:00" }, now);
    expect(ics).toContain("SUMMARY:Interview: Acme\\, Inc. - R (T)");
  });
});
