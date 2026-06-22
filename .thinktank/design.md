# Design System

## CSS Variable Tokens
| Variable | Value | Usage |
|----------|-------|-------|
| `--bg-color` | `#080c14` | Body background, very deep slate |
| `--panel-bg` | `rgba(13, 20, 35, 0.6)` | Blurry card background (glassmorphic) |
| `--accent` | `#00ffcc` | Bright glowing cyan |
| `--text-primary` | `#f3f4f6` | Warm off-white |
| `--text-secondary` | `#9ca3af` | Cool grey |
| `--danger` | `#ff4a6b` | Record/Alert pink |

## Canvas Layout Metrics
- **Dimensions**: 1080x1080 px internal Canvas resolution.
- **Ratios Supported**: 
  - Square (1:1): Standard canvas frame layout.
  - HD Landscape (16:9): Aspect ratio 1.778.
  - TikTok Vertical (9:16): Aspect ratio 0.5625 (optimal for social media reels).
- **Concentric Barriers**: Distribute $N$ rings between a minimum radius of 80px and maximum radius of 45% canvas height.
- **Ring Thickness**: 10px.
- **Ball Radius**: 6px - 30px (defaults to 12px).

## Typography
- **Title Headers**: `Plus Jakarta Sans`, bold and crisp.
- **HUD & Pill Values**: `Space Grotesk`, monospace font for numbers, seeds, and times.

## Audio & Synth Mapping
- **Scale**: C Major Pentatonic.
- **Trigger**: Plays pluck tone on collision. The ring index decides the pitch, playing higher frequencies for outer/deeper ring rebounds.
- **Waves**: Mixes triangle wave (50% gain) and sine wave (12% gain) with a low-pass sweep envelope.
