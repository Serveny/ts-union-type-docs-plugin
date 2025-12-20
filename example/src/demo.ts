/**
 * Available colors
 */
type Color =
	/**
	 * Primary color
	 */
	| 'red'

	/**
	 * Secondary color
	 */
	| 'green'

	/**
	 * Third color
	 *
	 * I'm blue da ba dee
	 */
	| 'blue'

	/**
	 * A number
	 *
	 * @range 1-4
	 */
	| `A${number}`;

/**
 * Const testn
 */
const color: Color = 'red';

/**
 * logColor docs
 */
function logColor(color2: Color): void {
	console.log(color2);
}

logColor('A5');

logColor('green');

type ClassColor = `Color-${Color}`;

/**
 * logColor docs
 */
function logColor2(color2: ClassColor): void {
	console.log(color2);
}

logColor2('Color-red');

/**
 * Very complex example
 */
type Group = MixxxControls.MixxxGroup;
type Control<TGroup> = MixxxControls.MixxxControl<TGroup>;
type ControlRW<TGroup> = MixxxControls.MixxxControlReadAndWrite<TGroup>;

/**
 * Gets the control value
 *
 * @param group Group of the control e.g. "[Channel1]"
 * @param Name of the control e.g. "play_indicator"
 * @returns Value of the control (within it's range according Mixxx Controls manual page:
 *          https://manual.mixxx.org/latest/chapters/appendix/mixxx_controls.html)
 */
function getValue<TGroup extends Group>(
	group: TGroup,
	name: Control<TGroup>
): number {
	return 0;
}

getValue('[Channel1]', 'beatjump_4_backward');

getValue('[Channel1]', 'CloneFromDeck');

getValue('[Channel1]', 'bpm_up_small');

getValue('[Channel1]', 'cue_mode');

/**
 * Inline union docs function
 */
function test(
	x: /**
	 * Bla docs
	 * */
	| 'bla'
		/**
		 * Blub docs
		 * */
		| 'blub'
) {}

test('bla');
