/*
 * Copyright (C) 2017 Stefano D'Angelo <zanga.mail@gmail.com>
 *
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
 * ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
 * ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
 * OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 */

var SFNTShaper = require("sfnt-shaper");

module.exports = function (Kroton) {
	Kroton.Layout = {
		x:		null,
		xMin:		null,
		xMax:		null,
		yMin:		null,
		yMax:		null,
		xAdvance:	null,

		shift: function (dx, dy) {
			this.x += dx;
			this.xMin += dx;
			this.xMax += dx;
			this.yMin += dy;
			this.yMax += dy;
		},

		scale: function (kx, ky) {
			this.x *= kx;
			this.xMin *= kx;
			this.xMax *= kx;
			this.yMin *= ky;
			this.yMax *= ky;
			this.xAdvance *= kx;
		}
	};

	Kroton.LayoutGlyph = Object.create(Kroton.Layout);
	Kroton.LayoutGlyph.charCode = null;

	Kroton.LayoutComposite = Object.create(Kroton.Layout);
	Kroton.LayoutComposite.y = null;
	Kroton.LayoutComposite.scaleX = 1;
	Kroton.LayoutComposite.scaleY = 1;
	Kroton.LayoutComposite.ascenderMax = null;
	Kroton.LayoutComposite.descenderMin = null;
	Kroton.LayoutComposite.expression = null;
	Kroton.LayoutComposite.children = null;
	Kroton.LayoutComposite.childrenHaveAscDesc = true;

	Kroton.LayoutComposite.shift = function (dx, dy) {
		Kroton.Layout.shift.call(this, dx, dy);
		this.y += dy;
		this.ascenderMax += dy;
		this.descenderMin += dy;
		for (var i = 0; i < this.children.length; i++)
			this.children[i].shift(dx, dy);
	};

	Kroton.LayoutComposite.scale = function (kx, ky) {
		Kroton.Layout.scale.call(this, kx, ky);
		this.scaleX *= kx;
		this.scaleY *= ky;
		this.y *= ky;
		this.ascenderMax *= ky;
		this.descenderMin *= ky;
		for (var i = 0; i < this.children.length; i++)
			this.children[i].scale(kx, ky);
	};

	Kroton.LayoutComposite.updateMinMax = function () {
		this.xMin = Infinity;
		this.xMax = -Infinity;
		this.yMin = Infinity;
		this.yMax = -Infinity;
		if (this.childrenHaveAscDesc) {
			this.ascenderMax = -Infinity;
			this.descenderMin = Infinity;
		}
		for (var i = 0; i < this.children.length; i++) {
			var c = this.children[i];
			this.xMin = Math.min(this.xMin, c.xMin);
			this.xMax = Math.max(this.xMax, c.xMax);
			this.yMin = Math.min(this.yMin, c.yMin);
			this.yMax = Math.max(this.yMax, c.yMax);
			if (this.childrenHaveAscDesc) {
				this.ascenderMax =
					Math.max(this.ascenderMax,
						 c.ascenderMax);
				this.descenderMin =
					Math.min(this.descenderMin,
						 c.descenderMin);
			}
		}
	};

	Kroton.LayoutText = Object.create(Kroton.LayoutComposite);
	Kroton.LayoutText.childrenHaveAscDesc = false;

	Kroton.LayoutText.fromString = function (string, metrics) {
		var g = SFNTShaper.getGlyphs(string);
		var l = SFNTShaper.layoutGlyphs(g, metrics);

		var ret = Object.create(Kroton.LayoutText);
		ret.x = 0;
		ret.y = 0;
		ret.xAdvance = l.advance;
		if (l.xMin) {
			ret.xMin = l.xMin;
			ret.xMax = l.xMax;
			ret.yMin = l.yMin;
			ret.yMax = l.yMax;
		} else {
			ret.xMin = 0;
			ret.xMax = l.advance;
			ret.yMin = 0;
			ret.yMax = 0;
		}
		ret.ascenderMax = metrics.ascender / metrics.unitsPerEm;
		ret.descenderMin = metrics.descender / metrics.unitsPerEm;
		ret.children = new Array(g.length);
		for (var i = 0; i < g.length; i++) {
			ret.children[i] = Object.create(Kroton.LayoutGlyph);
			var c = ret.children[i];
			c.xAdvance = l.glyphs[i].advance;
			c.x = l.glyphs[i].x;
			if (l.glyphs[i].xMin) {
				c.xMin = l.glyphs[i].xMin;
				c.xMax = l.glyphs[i].xMax;
				c.yMin = l.glyphs[i].yMin;
				c.yMax = l.glyphs[i].yMax;
			} else {
				c.xMin = 0;
				c.xMax = l.glyphs[i].advance;
				c.yMin = 0;
				c.yMax = 0;
			}
			c.charCode = g[i];
		}

		return ret;
	};

	Kroton.LayoutLine = Object.create(Kroton.LayoutComposite);

	Kroton.LayoutExpression = Object.create(Kroton.LayoutComposite);
	Kroton.LayoutExpression.yAdvance = null;
	Kroton.LayoutExpression.xAdvanceMax = null;
	Kroton.LayoutExpression.lineNumber = null;

	Kroton.LayoutExpression.shift = function (dx, dy) {
		if (this.lineNumber == null)
			Kroton.LayoutComposite.shift.call(this, dx, dy);
		else {
			var l = this.children[this.lineNumber];
			Kroton.LayoutComposite.shift.call(l, dx, dy);
			l.updateMinMax();
			this.updateMinMax();
		}
	};

	Kroton.LayoutExpression.scale = function (kx, ky) {
		if (this.lineNumber == null) {
			Kroton.LayoutComposite.scale.call(this, kx, ky);
			this.yAdvance *= ky;
			this.xAdvanceMax *= kx;
		} else {
			var l = this.children[this.lineNumber];
			Kroton.LayoutComposite.scale.call(l, kx, ky);
			l.updateMinMax();
			this.updateMinMax();
		}
	};

	Kroton.LayoutExpression.updateMinMax = function () {
		Kroton.LayoutComposite.updateMinMax.call(this);
		this.xAdvanceMax = -Infinity;
		for (var i = 0; i < this.children.length; i++)
			this.xAdvanceMax = Math.max(this.xAdvanceMax,
						    this.children[i].xAdvance);
	};

	Kroton.LayoutExpression.addDelimiters = function (metrics) {
		if (!this.expression.delimiterLeft
		    && !this.expression.delimiterRight)
			return;

		var This = this;
		function getT(d, t) {
			var hD = d.ascenderMax - d.descenderMin;
			var hE = -Infinity;
			var j;
			for (var i = 0; i < This.children.length; i++) {
				var c = This.children[i];
				if (c.ascenderMax - c.descenderMin > hE)
					hE = c.ascenderMax - c.descenderMin;
			}
			t.ky = hE / hD;
			var aD = t.ky * d.ascenderMax;
			c = This.children[0];
			t.dyL = c.ascenderMax - aD
				+ 0.5 * (c.ascenderMax - c.descenderMin - hE);
			c = This.children[This.children.length - 1];
			t.dyR = c.ascenderMax - aD;
			t.dyC = 0.5 * (c.ascenderMax - c.descenderMin - hE);
		}

		var l, r;
		var t = {};
		if (this.expression.delimiterLeft) {
			l = Kroton.LayoutText
				  .fromString(this.expression.delimiterLeft,
					      metrics);
			getT(l, t);
		}
		if (this.expression.delimiterRight) {
			r = Kroton.LayoutText
				  .fromString(this.expression.delimiterRight,
					      metrics);
			getT(r, t);
		}
		if (l) {
			var c = this.children[0];
			l.scale(1, t.ky);
			l.shift(0, t.dyL);
			var x = this.x;
			this.shift(l.xAdvance, 0);
			c.children.unshift(l);
			c.x = x;
			this.x = x;
			c.xAdvance += l.xAdvance;
			this.xAdvance += l.xAdvance;
			c.updateMinMax();
		}
		if (r) {
			var c = this.children[this.children.length - 1];
			r.scale(1, t.ky);
			r.shift(c.x + c.xAdvance, t.dyR);
			c.shift(0, t.dyC);
			c.children.push(r);
			c.xAdvance += r.xAdvance;
			this.xAdvance += r.xAdvance;
			this.yAdvance += t.dyC;
			c.updateMinMax();
		}
		this.updateMinMax();
	};

	Kroton.LayoutExpression.aliasLine = function (i) {
		this.lineNumber = i;
		this.x = this.children[i].x;
		this.y = this.children[i].y;
		this.xMin = this.children[i].xMin;
		this.xMax = this.children[i].xMax;
		this.yMin = this.children[i].yMin;
		this.yMax = this.children[i].yMax;
		this.xAdvance = this.children[i].xAdvance;
		this.yAdvance = 0;
		this.xAdvanceMax = this.xAdvance;
		this.ascenderMax = this.children[i].ascenderMax;
		this.descenderMin = this.children[i].descenderMin;
	};

	Kroton.LayoutPlaceholder = Object.create(Kroton.LayoutExpression);
	Kroton.LayoutPlaceholder.delimiterLeft = null;
	Kroton.LayoutPlaceholder.delimiterRight = null;

	Kroton.Expression.layout = function (metrics) {
		var ret = Object.create(Kroton.LayoutExpression);
		var line = Object.create(Kroton.LayoutLine);
		ret.children = [line];
		line.children = [];
		ret.xAdvance = 0;
		ret.yAdvance = 0;
		line.x = 0;
		line.y = 0;
		line.xAdvance = 0;
		for (var i = 0; i < this.children.length; i++) {
			var l = this.children[i].layout(metrics);
			l.shift(ret.xAdvance, ret.yAdvance);
			if (l.children.length > 1) {
				var ll = Object.create(l);
				ll.aliasLine(0);
				line.children.push(ll);
				line.xAdvance += l.children[0].xAdvance;
				for (var j = 1; j < l.children.length; j++) {
					line.updateMinMax();
					line = Object.create(Kroton.LayoutLine);
					var ll = Object.create(l);
					ll.aliasLine(j);
					line.children = [ll];
					ret.children.push(line);
					line.x = l.children[j].x;
					line.y = l.children[j].y;
					line.xAdvance = l.children[j].xAdvance;
				}
			} else {
				line.children.push(l);
				line.xAdvance += l.xAdvance;
			}
			ret.xAdvance += l.xAdvance;
			ret.yAdvance += l.yAdvance;
		}
		ret.x = 0;
		ret.y = 0;
		line.updateMinMax();
		ret.updateMinMax();
		ret.expression = this;
		ret.addDelimiters(metrics.regular);
		return ret;
	};

	Kroton.Text.layout = function (metrics) {
		var ret = Object.create(Kroton.LayoutExpression);
		var line = Object.create(Kroton.LayoutLine);
		var m = this.bold
			? (this.italic ? metrics.boldItalic : metrics.bold)
			: (this.italic ? metrics.italic : metrics.regular);
		var t = Kroton.LayoutText.fromString(this.value, m);
		if (this.big)
			t.scale(Math.SQRT2, Math.SQRT2);
		ret.children = [line];
		line.children = [t];
		ret.x = 0;
		ret.y = 0;
		ret.xAdvance = t.xAdvance;
		ret.yAdvance = 0;
		line.x = 0;
		line.y = 0;
		line.xAdvance = t.xAdvance;
		line.updateMinMax();
		ret.updateMinMax();
		ret.expression = this;
		line.children[0].expression = this;
		ret.addDelimiters(metrics.regular);
		return ret;
	};

	Kroton.Space.layout = function (metrics) {
		var ret = Kroton.Text.layout.call(this, metrics);
		if (this.size != 1)
			ret.scale(this.size, 1);
		return ret;
	};

	Kroton.Script.layout = function (metrics) {
		var ret = Object.create(Kroton.LayoutExpression);
		var line = Object.create(Kroton.LayoutLine);
		ret.children = [line];
		line.children = [];

		var m, tL, bL, bR, tR;
		var sBX = Math.max(metrics.regular.subscriptXSize
				   / metrics.regular.unitsPerEm, Math.SQRT1_2);
		var sTX = Math.max(metrics.regular.superscriptXSize
				   / metrics.regular.unitsPerEm, Math.SQRT1_2);
		var sBY = Math.max(metrics.regular.subscriptYSize
				   / metrics.regular.unitsPerEm, Math.SQRT1_2);
		var sTY = Math.max(metrics.regular.superscriptYSize
				   / metrics.regular.unitsPerEm, Math.SQRT1_2);
		if (this.topLeft) {
			tL = this.topLeft.layout(metrics);
			if (this.scaled)
				tL.scale(sTX, sTY);
			line.children.push(tL);
		}
		if (this.bottomLeft) {
			bL = this.bottomLeft.layout(metrics);
			if (this.scaled)
				bL.scale(sBX, sBY);
			line.children.push(bL);
		}
		m = this.main.layout(metrics);
		line.children.push(m);
		if (this.bottomRight) {
			bR = this.bottomRight.layout(metrics);
			if (this.scaled)
				bR.scale(sBX, sBY);
			line.children.push(bR);
		}
		if (this.topRight) {
			tR = this.topRight.layout(metrics);
			if (this.scaled)
				tR.scale(sTX, sTY);
			line.children.push(tR);
		}

		var kB = m.descenderMin / metrics.regular.descender;
		var kT = m.ascenderMax / metrics.regular.ascender;
		var dxB = kB * metrics.regular.subscriptXOffset;
		var dxT = kT * metrics.regular.superscriptXOffset;
		var dyB = -kB * metrics.regular.subscriptYOffset;
		var dyT = kT * metrics.regular.superscriptYOffset;

		if (tL && bL) {
			var o = dyB + bL.ascenderMax - dyT - tL.descenderMin;
			if (o > 0) {
				var d = 0.5 * o;
				dyT += d;
				dyB -= d;
			}
		}
		if (tR && bR) {
			var o = dyB + bR.ascenderMax - dyT - tR.descenderMin;
			if (o > 0) {
				var d = 0.5 * o;
				dyT += d;
				dyB -= d;
			}
		}

		if (tL || bL) {
			var dxTBL = tL && bL
				    ? bL.xAdvance - tL.xAdvance - dxB + dxT : 0;
			var dL;
			if (tL) {
				tL.shift(Math.max(dxTBL, 0), dyT);
				dL = tL.x + tL.xAdvance - dxT;
			}
			if (bL) {
				bL.shift(Math.max(-dxTBL, 0), dyB);
				dL = bL.x + bL.xAdvance - dxB;
			}
			m.shift(dL - m.xMin, 0);
		}
		if (bR)
			bR.shift(m.xMax + dxB, dyB);
		if (tR)
			tR.shift(m.xMax + dxT, dyT);

		ret.x = 0;
		ret.y = 0;
		ret.xAdvance =
			Math.max(m.x + m.xAdvance,
				 bR ? bR.x + bR.xAdvance : -Infinity,
				 tR ? tR.x + tR.xAdvance : -Infinity);
		ret.yAdvance = 0;
		line.x = 0;
		line.y = 0;
		line.xAdvance = ret.xAdvance;
		line.updateMinMax();
		ret.updateMinMax();
		ret.expression = this;
		ret.addDelimiters(metrics.regular);
		return ret;
	};

	Kroton.Stack.layout = function (metrics) {
		var ret = Object.create(Kroton.LayoutExpression);
		var line = Object.create(Kroton.LayoutLine);
		ret.children = [line];
		line.children = [];

		var m, o, u, mW, oW, uW, mML, oML, uML, mMR, oMR, uMR;
		var sBX = Math.max(metrics.regular.subscriptXSize
				   / metrics.regular.unitsPerEm, Math.SQRT1_2);
		var sTX = Math.max(metrics.regular.superscriptXSize
				   / metrics.regular.unitsPerEm, Math.SQRT1_2);
		var sBY = Math.max(metrics.regular.subscriptYSize
				   / metrics.regular.unitsPerEm, Math.SQRT1_2);
		var sTY = Math.max(metrics.regular.superscriptYSize
				   / metrics.regular.unitsPerEm, Math.SQRT1_2);
		m = this.main.layout(metrics);
		mW = m.xMax - m.xMin;
		mML = m.xMin;
		mMR = m.xAdvance - m.xMax;
		if (this.over) {
			o = this.over.layout(metrics);
			if (this.scaled)
				o.scale(sTX, sTY);
			oW = o.xMax - o.xMin;
			oML = o.xMin;
			oMR = o.xAdvance - o.xMax;
			o.shift(0, m.yMax
				   - (this.shiftedByYMinMax
				      ? o.yMin : o.descenderMin)
				   - metrics.regular.underlinePosition
				   / metrics.regular.unitsPerEm);
			line.children.push(o);
		}
		line.children.push(m);
		if (this.under) {
			u = this.under.layout(metrics);
			if (this.scaled)
				u.scale(sBX, sBY);
			uW = u.xMax - u.xMin;
			uML = u.xMin;
			uMR = u.xAdvance - u.xMax;
			u.shift(0, m.yMin
				   - (this.shiftedByYMinMax
				      ? u.yMax : u.ascenderMax)
				   + metrics.regular.underlinePosition
				   / metrics.regular.unitsPerEm);
			line.children.push(u);
		}

		var w = o && u ? Math.max(mW, oW, uW)
			       : (o ? Math.max(mW, oW)
				    : (u ? Math.max(mW, uW) : mW));
		m.shift(-mML, 0);
		if (o)
			o.shift(-oML, 0);
		if (u)
			u.shift(-uML, 0);
		if (this.mainStretched) {
			m.scale(w / mW, 1);
			mW = w;
		}
		if (o && this.overStretched) {
			o.scale(w / oW, 1);
			oW = w;
		}
		if (u && this.underStretched) {
			u.scale(w / uW, 1);
			uW = w;
		}
		if (mW < w)
			m.shift(0.5 * (w - mW), 0);
		if (o && oW < w)
			o.shift(0.5 * (w - oW), 0);
		if (u && uW < w)
			u.shift(0.5 * (w - uW), 0);
		var dx = o && u ? Math.max(mML - m.xMin, oML - o.xMin,
					   uML - u.xMin)
				: (o ? Math.max(mML - m.xMin, oML - o.xMin)
				     : (u ? Math.max(mML - m.xMin, uML - u.xMin)
					  : mML - m.xMin));
		ret.shift(dx, 0);

		ret.x = 0;
		ret.y = 0;
		ret.xAdvance = o && u ? Math.max(mMR + m.xMax, oMR + o.xMax,
					   uMR + u.xMax)
			       : (o ? Math.max(mMR + m.xMax, oMR + o.xMax)
				    : (u ? Math.max(mMR + m.xMax, uMR + u.xMax)
					 : mMR + m.xMax));
		ret.yAdvance = 0;
		line.x = 0;
		line.y = 0;
		line.xAdvance = ret.xAdvance;
		line.updateMinMax();
		ret.updateMinMax();
		ret.expression = this;
		ret.addDelimiters(metrics.regular);
		return ret;
	};

	Kroton.Root.layout = function (metrics) {
		var ret = Object.create(Kroton.LayoutExpression);
		var line = Object.create(Kroton.LayoutLine);

		var l = this.radicand.layout(metrics);
		var r = Kroton.LayoutText.fromString("√", metrics.regular);
		var b = Kroton.LayoutText.fromString("−", metrics.regular);
		ret.children = [line];
		line.children = [r, b, l];

		var u = -metrics.regular.underlinePosition
			/ metrics.regular.unitsPerEm;
		var hL = l.ascenderMax - l.descenderMin;
		var hR = r.ascenderMax - r.descenderMin + b.yMax - b.yMin + u;
		var ky = hL / hR;
		r.scale(1, ky);
		r.shift(0, l.descenderMin - r.descenderMin);
		l.shift(r.xAdvance, 0);
		b.shift(-b.xMin, 0);
		b.scale((l.xMax - r.xAdvance) / b.xMax, 1);
		b.shift(r.xAdvance, r.yMax - b.yMax);
		b.xAdvance = b.xMax - b.x;
		b.ascenderMax = b.yMax;
		b.descenderMin = b.yMin;

		if (this.index) {
			var i = this.index.layout(metrics);
			line.children.unshift(i);

			var sTX = Math.max(metrics.regular.superscriptXSize
					   / metrics.regular.unitsPerEm,
					   Math.SQRT1_2);
			var sTY = Math.max(metrics.regular.superscriptYSize
					   / metrics.regular.unitsPerEm,
					   Math.SQRT1_2);
			if (this.scaled)
				i.scale(sTX, sTY);
			i.shift(r.xMin + 0.5 * (r.xMax - r.xMin) - i.xAdvance,
				r.yMin + 0.5 * (r.yMax - r.yMin)
				- i.descenderMin  + u);
			if (i.x < 0)
				ret.shift(-i.x, 0);
		}

		ret.x = 0;
		ret.y = 0;
		ret.xAdvance = l.x + l.xAdvance;
		ret.yAdvance = 0;
		line.x = 0;
		line.y = 0;
		line.xAdvance = ret.xAdvance;
		line.updateMinMax();
		ret.updateMinMax();
		ret.expression = this;
		ret.addDelimiters(metrics.regular);
		return ret;
	};

	Kroton.Grid.layout = function (metrics) {
		var ret = Object.create(Kroton.LayoutExpression);
		var line = Object.create(Kroton.LayoutLine);
		ret.children = [line];
		line.children = [];

		var vs = -metrics.regular.underlinePosition
			 / metrics.regular.unitsPerEm;
		var hs = Kroton.LayoutText.fromString(" ", metrics.regular)
					  .xAdvance;
		var vl = Kroton.LayoutText.fromString("|", metrics.regular);
		vl.xAdvance = vl.xMax;
		vl.ascenderMax = vl.yMax;
		vl.descenderMin = vl.yMin;
		var hl = Kroton.LayoutText.fromString("−", metrics.regular);
		hl.xAdvance = hl.xMax;
		hl.ascenderMax = hl.yMax;
		hl.descenderMin = hl.yMin;
		var vlW = vl.xMax - vl.xMin;
		var hlH = hl.yMax - hl.yMin;

		var m = this.cells.length;
		var n = this.cells[0].length;
		var dy = 0;
		var l = [];
		var hls = [];
		var vls = [];
		for (var i = 0; i < m; i++) {
			l[i] = [];
			var aMax = 0;
			var dMin = 0;
			for (var j = 0; j < n; j++) {
				l[i][j] = this.cells[i][j].layout(metrics);
				line.children.push(l[i][j]);
				aMax = Math.max(aMax, l[i][j].ascenderMax);
				dMin = Math.min(dMin, l[i][j].descenderMin);
			}
			dy -= aMax;
			for (var j = 0; j < n; j++)
				l[i][j].shift(0, dy);
			dy -= vs - dMin;
			if (this.horizontalLines
			    && this.horizontalLines.indexOf(i) != -1) {
				var h = Object.create(hl);
				h.shift(0, dy - h.yMin);
				hls.push(h);
				dy -= hlH;
			}
		}
		var dx = 0;
		ret.xAdvance = -Infinity;
		for (var j = 0; j < n; j++) {
			var aMax = 0;
			for (var i = 0; i < m; i++)
				aMax = Math.max(aMax, l[i][j].xAdvance);
			for (var i = 0; i < m; i++)
				l[i][j].shift(this.centerAligned
					? dx + 0.5 * (aMax - l[i][j].xAdvance)
					: dx, 0);
			ret.xAdvance = Math.max(ret.xAdvance, dx + aMax);
			dx += aMax + hs;
			if (this.verticalLines
			    && this.verticalLines.indexOf(j) != -1) {
				var v = Object.create(vl);
				v.shift(dx - v.xMin, 0);
				vls.push(v);
				dx += vlW;
			}
			dx += hs;
		}

		var y = 0;
		for (var i = 0; i < m; i++)
			y += l[i][0].y;

		line.updateMinMax();

		for (var i = 0; i < hls.length; i++) {
			var yMax = hls[i].yMax;
			hls[i].scale((line.xMax - line.xMin)
				     / (hls[i].xMax - hls[i].xMin), 1);
			hls[i].shift(ret.xMin - hls[i].xMin,
				     yMax - hls[i].yMax);
		}
		for (var i = 0; i < vls.length; i++) {
			var xMin = vls[i].xMin;
			vls[i].scale(1, (line.yMax - line.yMin)
					/ (vls[i].yMax - vls[i].yMin));
			vls[i].shift(xMin - vls[i].xMin,
				     line.yMax - vls[i].yMax);
		}
		line.children = line.children.concat(hls, vls);

		ret.x = 0;
		ret.y = 0;
		ret.yAdvance = 0;
		line.x = 0;
		line.y = 0;
		line.xAdvance = ret.xAdvance;
		line.updateMinMax();
		ret.updateMinMax();
		ret.shift(0, -y / m);
		ret.expression = this;
		ret.addDelimiters(metrics.regular);
		return ret;
	};

	Kroton.Multiline.layout = function (metrics) {
		var ret = Object.create(Kroton.LayoutExpression);
		ret.children = [];

		var g = metrics.regular.lineGap / metrics.regular.unitsPerEm;
		var dy = 0;
		ret.yAdvance = 0;
		for (var i = 0; i < this.children.length; i++) {
			var l = this.children[i].layout(metrics);
			for (var j = 0; j < l.children.length; j++) {
				var ll = Object.create(l);
				ll.aliasLine(j);
				var line = Object.create(Kroton.LayoutLine);
				line.children = [ll];
				line.x = 0;
				line.y = 0;
				line.xAdvance = ll.xAdvance;
				line.updateMinMax();
				if (i != 0) {
					dy -= line.ascenderMax;
					line.shift(0, dy);
					ret.yAdvance = dy;
				}
				ret.xAdvance = line.xAdvance;
				ret.children.push(line);
				dy += l.descenderMin - g;
			}
		}
		ret.x = 0;
		ret.y = 0;
		ret.updateMinMax();
		ret.expression = this;
		ret.addDelimiters(metrics.regular);
		return ret;
	};

	Kroton.Placeholder.layout = function (metrics) {
		var l = this.definition.layout(metrics);
		var ret = Object.create(Kroton.LayoutPlaceholder);
		ret.x = 0;
		ret.y = 0;
		ret.xMin = l.xMin;
		ret.xMax = l.xMax;
		ret.yMin = l.yMin;
		ret.yMax = l.yMax;
		ret.xAdvance = l.xAdvance;
		ret.yAdvance = l.yAdvance;
		ret.xAdvanceMax = l.xAdvanceMax;
		ret.ascenderMax = l.ascenderMax;
		ret.descenderMin = l.descenderMin;
		ret.children = l.children;
		ret.expression = this;
		ret.addDelimiters(metrics.regular);
		if (this.delimiterLeft)
			ret.delimiterLeft = ret.children[0].children[0];
		if (this.delimiterRight) {
			var l = ret.children[ret.children.length - 1];
			ret.delimiterRight = l.children[l.children.length - 1];
		}
		return ret;
	};
};
