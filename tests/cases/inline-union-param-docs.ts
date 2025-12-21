/**
 * Inline union docs function
 */
function test(
	x: /**
	 * foo docs
	 * */
	| 'foo'
		/**
		 * bar docs
		 * */
		| 'bar'
) {}

test('bar');
