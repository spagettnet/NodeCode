class Point {
	constructor(x = 0, y = 0) {
		this.x = x;
		this.y = y;
	}

	addp(other) {
		return new Point(this.x + other.x, this.y + other.y);
	}

	subtractp(other) {
		return new Point(this.x - other.x, this.y - other.y);
	}

	multiplyp(other) {
		return new Point(this.x * other.x, this.y * other.y);
	}

	dividep(other) {
		return new Point(this.x / other.x, this.y / other.y);
	}

	add1(other) {
		return new Point(this.x + other, this.y + other);
	}

	subtract1(other) {
		return new Point(this.x - other, this.y - other);
	}

	multiply1(other) {
		return new Point(this.x * other, this.y * other);
	}

	divide1(other) {
		return new Point(this.x / other, this.y / other);
	}

	add2(x, y) {
		return new Point(this.x + x, this.y + y);
	}

	subtract2(x, y) {
		return new Point(this.x - x, this.y - y);
	}

	multiply2(x, y) {
		return new Point(this.x * x, this.y * y);
	}

	divide2(x, y) {
		return new Point(this.x / x, this.y / y);
	}

	floor() {
		return new Point(Math.floor(this.x), Math.floor(this.y));
	}

	addComponents() {
		return this.x + this.y;
	}

	lengthSquared() {
		return this.x * this.x + this.y * this.y;
	}

	length() {
		return Math.sqrt(this.lengthSquared());
	}
}