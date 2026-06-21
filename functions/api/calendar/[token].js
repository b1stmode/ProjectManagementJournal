export async function onRequestGet({ params, env }) {
  // Strip optional .ics extension so both /UUID and /UUID.ics work
  const rawToken = params.token ?? '';
  const token = rawToken.endsWith('.ics') ? rawToken.slice(0, -4) : rawToken;

  if (!token || token !== env.CALENDAR_TOKEN) {
    return new Response('Not found', { status: 404 });
  }

  const sbHeaders = {
    'apikey': env.SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${env.SUPABASE_ANON_KEY}`,
  };

  const [projectsRes, datesRes, sessionsRes] = await Promise.all([
    fetch(`${env.SUPABASE_URL}/rest/v1/projects?select=id,name`, { headers: sbHeaders }),
    fetch(`${env.SUPABASE_URL}/rest/v1/important_dates?select=*`, { headers: sbHeaders }),
    fetch(`${env.SUPABASE_URL}/rest/v1/planned_sessions?select=*`, { headers: sbHeaders }),
  ]);

  if (!projectsRes.ok || !datesRes.ok || !sessionsRes.ok) {
    return new Response('Failed to fetch calendar data', { status: 500 });
  }

  const [projects, dates, sessions] = await Promise.all([
    projectsRes.json(),
    datesRes.json(),
    sessionsRes.json(),
  ]);

  const projectMap = Object.fromEntries(projects.map(p => [p.id, p.name]));
  const dtstamp = new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z';

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//PM Journal//EN',
    'CALSCALE:GREGORIAN',
    'X-WR-CALNAME:PM Journal',
    'X-WR-CALDESC:Important dates and planned sessions from PM Journal',
  ];

  for (const d of dates) {
    const start = d.date.replace(/-/g, '');
    const end   = nextDay(d.date);
    const projectName = projectMap[d.project_id] ?? '';
    const description = [projectName, d.note].filter(Boolean).join(' — ');

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:date-${d.id}@pmjournal`);
    lines.push(`DTSTAMP:${dtstamp}`);
    lines.push(`DTSTART;VALUE=DATE:${start}`);
    lines.push(`DTEND;VALUE=DATE:${end}`);
    lines.push(fold(`SUMMARY:${esc(d.name)}`));
    if (description) lines.push(fold(`DESCRIPTION:${esc(description)}`));
    lines.push('END:VEVENT');
  }

  for (const s of sessions) {
    const start = s.date.replace(/-/g, '');
    const end   = nextDay(s.date);
    const projectName = projectMap[s.project_id] ?? '';
    const typeLabel = s.type.charAt(0).toUpperCase() + s.type.slice(1);
    const summary = `${typeLabel} session${projectName ? ' — ' + projectName : ''}`;

    lines.push('BEGIN:VEVENT');
    lines.push(`UID:session-${s.id}@pmjournal`);
    lines.push(`DTSTAMP:${dtstamp}`);
    lines.push(`DTSTART;VALUE=DATE:${start}`);
    lines.push(`DTEND;VALUE=DATE:${end}`);
    lines.push(fold(`SUMMARY:${esc(summary)}`));
    if (s.note) lines.push(fold(`DESCRIPTION:${esc(s.note)}`));
    lines.push('END:VEVENT');
  }

  lines.push('END:VCALENDAR');

  return new Response(lines.join('\r\n'), {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}

function nextDay(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

function esc(str) {
  return String(str)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

function fold(line) {
  if (line.length <= 75) return line;
  let out = '';
  let pos = 0;
  while (pos < line.length) {
    const chunk = pos === 0 ? 75 : 74;
    out += (pos === 0 ? '' : '\r\n ') + line.slice(pos, pos + chunk);
    pos += chunk;
  }
  return out;
}
