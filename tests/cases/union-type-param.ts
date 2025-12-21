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
	 *
	 * @color green
	 */
	| 'green'

	// This has no JS doc comment
	| 'blue'

	/**
	 * A number
	 *
	 * @range 1-4
	 */
	| `A${number}`;

/**
 * logColor docs
 */
function logColor(color: Color): void {
	console.log(color);
}

logColor('red');
logColor('green');
logColor('blue');
logColor('A100');
// @ts-ignore
logColor('');

type ClassColor = `Color-${Color}`;

/**
 * logClassColor docs
 */
function logClassColor(color: ClassColor): void {
	console.log(color);
}

logClassColor('Color-red');
logClassColor('Color-green');
logClassColor('Color-blue');
logClassColor('Color-A100');
// @ts-ignore
logClassColor('');

type ClassNColor = `Color-${number}-${Color}`;

function logNColor(color2: ClassNColor): void {
	console.log(color2);
}

logNColor('Color-1-red');
logNColor('Color-1-A1');
// @ts-ignore
logNColor('');
