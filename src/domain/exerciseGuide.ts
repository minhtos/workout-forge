export const equipmentKinds = ['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight'] as const
export type Equipment = (typeof equipmentKinds)[number]
export const equipmentLabels: Record<Equipment, string> = { barbell: 'Barbell', dumbbell: 'Dumbbell', machine: 'Machine', cable: 'Cable', bodyweight: 'Bodyweight' }

export interface ExerciseGuide { equipment: Equipment; cues: string[] }
/** Longest a single cue may be, so it fits one or two lines on a phone. */
export const maxCueLength = 60

/**
 * Form cues for the built-in exercises, keyed by exercise id (see baseExercises in program.ts). Display-only constants:
 * nothing here is stored, synced or exported, and custom exercises have no entry. The first cue targets the most common fault.
 */
export const exerciseGuide: Record<string, ExerciseGuide> = {
  // Chest
  'barbell-bench-press': { equipment: 'barbell', cues: ['Shoulder blades back and down, hold them there', 'Bar touches mid-chest, forearms vertical', 'Feet planted, drive through the floor'] },
  'barbell-incline-bench-press': { equipment: 'barbell', cues: ['Shoulder blades pinned back and down', 'Lower to the upper chest, elbows about 45°', 'Keep your hips on the bench'] },
  'dumbbell-incline-bench-press': { equipment: 'dumbbell', cues: ['Lower until your elbows are just below the bench', 'Wrists stacked over elbows', 'Press up and slightly in, no clanking'] },
  'machine-incline-press': { equipment: 'machine', cues: ['Set the seat so the handles line up with upper chest', 'Back flat on the pad, shoulders down', 'Press without shrugging'] },
  'machine-chest-press': { equipment: 'machine', cues: ['Set the seat so the handles sit at mid-chest', 'Back on the pad, shoulders down and back', 'Stop just short of locking out'] },
  'machine-fly': { equipment: 'machine', cues: ['Soft bend in the elbows, keep it fixed', 'Squeeze the chest, not the hands', 'Let the arms open only as far as is comfortable'] },
  'dumbbell-fly': { equipment: 'dumbbell', cues: ['Soft elbows, hold that bend the whole rep', 'Stop when you feel a stretch, no deeper', 'Hug a barrel to bring the weights up'] },

  // Back
  'pull-ups': { equipment: 'bodyweight', cues: ['Start each rep from a full hang, shoulders down', 'Drive elbows to your ribs, chest to the bar', 'No kipping, lower with control'] },
  'assisted-pull-ups': { equipment: 'machine', cues: ['Start each rep from a full hang, shoulders down', 'Drive elbows to your ribs, chest up', 'Lower slowly, don\'t drop into the stack'] },
  'pull-down': { equipment: 'cable', cues: ['Lean back slightly, chest up', 'Pull the bar to your collarbone', 'Elbows down and in, don\'t yank with the body'] },
  'row-machine': { equipment: 'machine', cues: ['Chest stays on the pad, shoulders down', 'Pull elbows back, squeeze shoulder blades', 'Pause, then return slowly'] },
  'tbar-row': { equipment: 'barbell', cues: ['Hinge at the hips, back flat', 'Pull elbows toward your hips', 'Keep your torso still, no jerking up'] },
  'barbell-row': { equipment: 'barbell', cues: ['Hinge at the hips, back flat, brace your core', 'Pull the bar to your lower ribs', 'Keep your torso still, no heaving'] },
  'barbell-deadlift': { equipment: 'barbell', cues: ['Bar over mid-foot, tension on the bar before you pull', 'Chest up, back flat, brace hard', 'Push the floor away, then hips through'] },

  // Shoulders
  'barbell-overhead-press': { equipment: 'barbell', cues: ['Squeeze glutes and brace, ribs down', 'Move your head back, then through at the top', 'Stack the bar over your mid-foot'] },
  'dumbbell-shoulder-press': { equipment: 'dumbbell', cues: ['Ribs down, don\'t arch your lower back', 'Press up and slightly in', 'Lower to ear level with control'] },
  'lateral-raise': { equipment: 'dumbbell', cues: ['Lead with the elbows, not the hands', 'Raise to shoulder height and stop', 'Light weight, no swinging'] },
  'rear-delt-fly': { equipment: 'dumbbell', cues: ['Hinge forward, back flat', 'Lead with the elbows, arms wide', 'Squeeze the rear delts, don\'t shrug'] },
  'face-pull': { equipment: 'cable', cues: ['Pull to your eyes, elbows high', 'Pull the rope apart as it comes in', 'Stay tall, no leaning back'] },

  // Triceps
  'dumbbell-tricep-extension': { equipment: 'dumbbell', cues: ['Keep your elbows pointing forward, not flaring', 'Lower slowly behind your head', 'Only the forearms move'] },
  'cable-pushdown': { equipment: 'cable', cues: ['Pin your elbows to your sides', 'Press down until your arms lock out', 'Control the way up, no leaning on it'] },
  'cable-single-arm-pulldown': { equipment: 'cable', cues: ['Pin your elbow to your side', 'Press down until your arm locks out', 'Stay tall, no twisting'] },
  'cable-pulldown': { equipment: 'cable', cues: ['Pin your elbows to your sides', 'Press down until your arms lock out', 'Control the way up, no leaning on it'] },
  'cable-overhead-extension': { equipment: 'cable', cues: ['Keep your elbows high and pointing forward', 'Ribs down, don\'t arch your back', 'Extend fully, then stretch slowly'] },

  // Biceps
  'incline-dumbbell-curls': { equipment: 'dumbbell', cues: ['Let your arms hang straight down behind you', 'Keep your elbows back, don\'t swing forward', 'Lower slowly to a full stretch'] },
  'cable-curls': { equipment: 'cable', cues: ['Elbows stay pinned to your sides', 'Curl up, squeeze, lower slowly', 'No leaning back'] },
  'barbell-curls': { equipment: 'barbell', cues: ['Elbows stay pinned to your sides', 'Stand tall, no swinging the hips', 'Lower slowly to full extension'] },

  // Forearms
  'barbell-wrist-curl': { equipment: 'barbell', cues: ['Forearms rest on your thighs, wrists off the edge', 'Move only at the wrist, full range', 'Slow on the way down'] },
  'reverse-wrist-curl': { equipment: 'dumbbell', cues: ['Forearms rest on a bench, palms down', 'Move only at the wrist, full range', 'Light weight, slow reps'] },
  'reverse-barbell-curl': { equipment: 'barbell', cues: ['Overhand grip, elbows pinned to your sides', 'Keep your wrists straight', 'Lower slowly, no swinging'] },
  'cable-wrist-curl': { equipment: 'cable', cues: ['Forearms rest on a bench, wrists off the edge', 'Move only at the wrist, full range', 'Slow on the way down'] },
  'farmers-carry': { equipment: 'dumbbell', cues: ['Stand tall, shoulders back and down', 'Squeeze the handles hard', 'Short, quick steps, no leaning'] },

  // Quads
  'quad-extension': { equipment: 'machine', cues: ['Set the pad just above your ankles', 'Squeeze the quads at the top', 'Lower slowly, hips stay down'] },
  'barbell-squat': { equipment: 'barbell', cues: ['Brace like you\'re about to be punched', 'Knees track over your toes', 'Chest up, drive up through mid-foot'] },
  'leg-press-machine': { equipment: 'machine', cues: ['Lower back and hips stay on the pad', 'Knees track over your toes, don\'t cave in', 'Stop before your hips curl up'] },
  'hack-squat': { equipment: 'machine', cues: ['Back and hips stay flat on the pad', 'Knees track over your toes', 'Drive through the whole foot'] },

  // Hamstrings
  'good-mornings': { equipment: 'barbell', cues: ['Push your hips back, soft knees', 'Back flat, brace your core', 'Stop when your hamstrings are fully stretched'] },
  'dumbbell-rdl': { equipment: 'dumbbell', cues: ['Push your hips back, soft knees', 'Dumbbells stay close to your legs', 'Back flat, stop at the stretch'] },
  'seated-leg-curl': { equipment: 'machine', cues: ['Hips back in the seat, pad above your heels', 'Curl all the way, squeeze', 'Lower slowly, don\'t let the weight drop'] },
  'lying-leg-curl': { equipment: 'machine', cues: ['Hips stay pressed into the pad', 'Curl all the way, squeeze', 'Lower slowly, don\'t let the weight drop'] },

  // Glutes
  'barbell-hip-thrust': { equipment: 'barbell', cues: ['Chin tucked, ribs down at the top', 'Shins vertical, squeeze glutes to lock out', 'Don\'t arch your lower back'] },
  'machine-hip-thrust': { equipment: 'machine', cues: ['Chin tucked, ribs down at the top', 'Squeeze glutes to lock out', 'Don\'t arch your lower back'] },
  'machine-glute-kickback': { equipment: 'machine', cues: ['Press through the heel, squeeze at the top', 'Hips stay square, no twisting', 'Control the return'] },
  'cable-pull-through': { equipment: 'cable', cues: ['Push your hips back, soft knees', 'Squeeze glutes to stand tall', 'Back flat, arms just hang'] },
  'dumbbell-walking-lunge': { equipment: 'dumbbell', cues: ['Take a long step, torso upright', 'Front knee tracks over your toes', 'Drive up through the front heel'] },

  // Calves
  'standing-calf-raise': { equipment: 'machine', cues: ['Full stretch at the bottom, pause', 'Rise high onto your big toe', 'Knees nearly straight, no bouncing'] },
  'seated-calf-raise': { equipment: 'machine', cues: ['Full stretch at the bottom, pause', 'Rise high onto your big toe', 'Slow reps, no bouncing'] },
  'leg-press-calf-raise': { equipment: 'machine', cues: ['Full stretch at the bottom, pause', 'Rise high onto your big toe', 'Keep your knees nearly straight'] },
  'smith-machine-calf-raise': { equipment: 'machine', cues: ['Full stretch at the bottom, pause', 'Rise high onto your big toe', 'Stand tall, no bouncing'] },
  'donkey-calf-raise': { equipment: 'machine', cues: ['Full stretch at the bottom, pause', 'Rise high onto your big toe', 'Keep your hips level, no bouncing'] },

  // Core
  'cable-crunch': { equipment: 'cable', cues: ['Curl your ribs toward your hips', 'Hips stay still, don\'t sit back', 'Exhale hard at the bottom'] },
  'hanging-leg-raise': { equipment: 'bodyweight', cues: ['Shoulders down, no swinging', 'Curl your pelvis up, don\'t just lift the legs', 'Lower slowly'] },
  'ab-wheel-rollout': { equipment: 'bodyweight', cues: ['Tuck your pelvis, ribs down, no sagging', 'Roll out only as far as you can control', 'Pull back with your abs'] },
  'decline-sit-up': { equipment: 'bodyweight', cues: ['Curl up one vertebra at a time', 'Hands across your chest, don\'t pull on your neck', 'Lower slowly'] },
  'machine-crunch': { equipment: 'machine', cues: ['Curl your ribs toward your hips', 'Don\'t pull with your arms', 'Exhale hard at the bottom'] },
}

/** The guide for a built-in exercise, or undefined for a custom one. */
export const guideFor = (id: string): ExerciseGuide | undefined => (Object.hasOwn(exerciseGuide, id) ? exerciseGuide[id] : undefined)
