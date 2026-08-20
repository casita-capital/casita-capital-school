import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const providerToken = searchParams.get('token');

  if (providerToken) {
    try {
      const res = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
        headers: {
          Authorization: `Bearer ${providerToken}`,
        },
      });

      if (res.ok) {
        const data = await res.json();
        return NextResponse.json(data);
      } else {
        const errorText = await res.text();
        return NextResponse.json(
          { error: `Google API Error (${res.status}): ${errorText}`, items: [] },
          { status: res.status }
        );
      }
    } catch (err: unknown) {
      const errText = err instanceof Error ? err.message : 'Fetch failed';
      return NextResponse.json({ error: errText, items: [] }, { status: 500 });
    }
  }

  // Sample default discovery calendars for fallback
  return NextResponse.json({
    items: [
      {
        id: 'primary',
        summary: 'Personal Google Calendar (Primary)',
        description: 'Main Google Calendar',
        backgroundColor: '#4285F4',
        primary: true,
      },
      {
        id: 'family_schedule_shared@group.calendar.google.com',
        summary: 'Womble Family & Kids Schedule',
        description: 'Shared family activities & sports',
        backgroundColor: '#0F9D58',
      },
      {
        id: 'casita_school_events@group.calendar.google.com',
        summary: 'Casita Capital School Events',
        description: 'School academic events & field trips',
        backgroundColor: '#F4B400',
      },
      {
        id: 'extracurricular_sports@group.calendar.google.com',
        summary: 'Extracurricular & Martial Arts',
        description: 'After-school practice and classes',
        backgroundColor: '#AB47BC',
      },
    ],
  });
}
