/**
 * PLAN3D-REALISM2-2433 S4: the realistic level's colour grade - lift / gamma / gain and saturation in display space, applied in
 * the post chain's existing output pass after the Neutral tone mapping and the sRGB transfer (post-chain.gradeOutput): no extra
 * pass, no extra target. Pure numbers here so node tests pin them.
 *
 * Per style a day and a night grade, mixed by the sun recipe's night factor:
 * - day: shadows lifted a touch cool, highlights a touch warm, saturation +4 % - the sunlit plaster stays neutral white;
 * - night: blue-teal shadows, warm gain for the lamp-lit rooms, a little more contrast - the "lights on at dusk" look.
 * The grade is a nudge, not a look change: every channel moves under 3 % at mid grey (unit-plan3d-grade.spec.ts).
 *
 * Formula per channel (c in 0..1, display space): c' = (c * gain + lift * (1 - c)) ^ (1 / gamma); then saturation around the
 * Rec. 709 luma.
 */
import type { StyleId } from './look-style';

export type Rgb = [number, number, number];
export interface Grade {
  lift: Rgb;
  gamma: Rgb;
  gain: Rgb;
  saturation: number;
}
export const IDENTITY_GRADE: Grade = { lift: [0, 0, 0], gamma: [1, 1, 1], gain: [1, 1, 1], saturation: 1 };

export const GRADES: Record<StyleId, { day: Grade; night: Grade }> = {
  light: {
    day: { lift: [0.004, 0.006, 0.012], gamma: [1, 1, 1], gain: [1.015, 1.0, 0.98], saturation: 1.04 },
    night: { lift: [0.0, 0.01, 0.026], gamma: [0.97, 0.98, 1.0], gain: [1.04, 1.0, 0.95], saturation: 1.06 },
  },
  dark: {
    day: { lift: [0.004, 0.008, 0.016], gamma: [1, 1, 1.01], gain: [1.0, 1.0, 0.99], saturation: 1.03 },
    night: { lift: [0.0, 0.012, 0.03], gamma: [0.96, 0.98, 1.0], gain: [1.05, 1.0, 0.93], saturation: 1.08 },
  },
};

const mix = (a: number, b: number, t: number): number => a + (b - a) * t;
const mix3 = (a: Rgb, b: Rgb, t: number): Rgb => [mix(a[0], b[0], t), mix(a[1], b[1], t), mix(a[2], b[2], t)];

/** The grade of a style at a night factor (0 day .. 1 night; clamped). */
export function gradeFor(style: StyleId, night: number): Grade {
  const g = GRADES[style] ?? GRADES.light;
  const t = Math.min(1, Math.max(0, Number.isFinite(night) ? night : 0));
  return { lift: mix3(g.day.lift, g.night.lift, t), gamma: mix3(g.day.gamma, g.night.gamma, t), gain: mix3(g.day.gain, g.night.gain, t), saturation: mix(g.day.saturation, g.night.saturation, t) };
}

/** The grade applied to one display-space colour (the shader's formula; tests). */
export function applyGrade(c: Rgb, g: Grade): Rgb {
  const out = c.map((v, i) => Math.pow(Math.max(0, v * g.gain[i] + g.lift[i] * (1 - v)), 1 / g.gamma[i])) as Rgb;
  const l = 0.2126 * out[0] + 0.7152 * out[1] + 0.0722 * out[2];
  return out.map((v) => l + (v - l) * g.saturation) as Rgb;
}

/** The GLSL the output pass appends (gl_FragColor in display space). */
export const GRADE_GLSL = /* glsl */ `
	{
		vec3 swC = gl_FragColor.rgb * swGain + swLift * ( 1.0 - gl_FragColor.rgb );
		swC = pow( max( swC, vec3( 0.0 ) ), 1.0 / swGamma );
		float swL = dot( swC, vec3( 0.2126, 0.7152, 0.0722 ) );
		gl_FragColor.rgb = mix( vec3( swL ), swC, swSat );
	}`;
