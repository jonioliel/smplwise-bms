import { defaultConfig, type ForecastEntry, type HomeView } from '../api/home-config';

/** The static demo's home block (no backend): the control-centre default with a weather entity, the Jewish calendar's
 * sensors and an alarm panel, all made up. The dates are relative to now, so the forecast and the candle lighting are
 * always ahead of the viewer. */
export function demoHome(now: Date = new Date()): HomeView {
  const cfg = defaultConfig();
  cfg.weather.entity = 'weather.home_wx';
  cfg.calendar = { date: 'sensor.jewish_calendar_date', parsha: 'sensor.jewish_calendar_weekly_portion', candles: 'sensor.jewish_calendar_upcoming_candle_lighting', havdalah: 'sensor.jewish_calendar_upcoming_havdalah', holiday: '', extras: [] };
  const day = 86_400_000;
  const conditions = ['sunny', 'sunny', 'partlycloudy', 'rainy', 'cloudy'];
  const forecast: ForecastEntry[] = conditions.map((condition, i) => ({ datetime: new Date(now.getTime() + (i + 1) * day).toISOString(), condition, temperature: [29, 30, 27, 24, 25][i], templow: [19, 20, 18, 17, 17][i] }));
  // the coming Friday 17:34 and Saturday 18:29 (Jerusalem clock times are close enough for a demo)
  const friday = new Date(now);
  friday.setDate(friday.getDate() + ((5 - friday.getDay() + 7) % 7 || 7));
  friday.setHours(17, 34, 0, 0);
  const saturday = new Date(friday.getTime() + day);
  saturday.setHours(18, 29, 0, 0);
  const sensor = (state: string, name: string, deviceClass: string | null = null) => ({ state, name, unit: null, device_class: deviceClass, available: true });
  return {
    direction: 'a',
    side: 'end',
    time_zone: 'Asia/Jerusalem',
    personalize: false,
    config: cfg,
    data: {
      weather: {
        entity_id: 'weather.home_wx',
        name: 'תחזית הבית',
        available: true,
        condition: 'partlycloudy',
        values: { temperature: { v: 28, unit: '°C' }, humidity: { v: 61, unit: '%' }, wind: { v: 14, unit: 'km/h' }, pressure: { v: 1013, unit: 'hPa' } },
        forecast,
        forecast_len: forecast.length,
        offers: ['condition', 'temperature', 'humidity', 'wind', 'pressure', 'forecast'],
      },
      sensors: {
        'sensor.jewish_calendar_date': sensor('ג׳ בחשוון התשפ״ז', 'תאריך עברי'),
        'sensor.jewish_calendar_weekly_portion': sensor('נח', 'פרשת השבוע'),
        'sensor.jewish_calendar_upcoming_candle_lighting': sensor(friday.toISOString(), 'הדלקת נרות', 'timestamp'),
        'sensor.jewish_calendar_upcoming_havdalah': sensor(saturday.toISOString(), 'צאת שבת', 'timestamp'),
      },
      alarm: { entity_id: 'alarm_control_panel.demo', name: 'אזעקה', state: 'armed_away', since: new Date(now.getTime() - 3 * 3600_000).toISOString(), available: true },
    },
  };
}
