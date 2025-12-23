import { Color } from './union-type-param.ts';

type ClassColor = `Color-${Color}`;

/**
 * logClassColor docs
 */
function logClassColor(color: ClassColor): void {
	console.log(color);
}

logClassColor('Color-red');
logClassColor('Color-green/[.*+?^${}()|[]-]/g');
logClassColor('Color-blue');
logClassColor('Color-A100');
// @ts-ignore
logClassColor('');

type ClassNColor = `Color-${number}-${Color}`;

function logNColor(color: ClassNColor): void {
	console.log(color);
}

logNColor('Color-1-red');
logNColor('Color-1-A1');
logNColor('Color-1-green/[.*+?^${}()|[]-]/g');
// @ts-ignore
logNColor('');
