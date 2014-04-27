// 
// Copyright (C) 2014 by Juan J. Martinez <jjm@usebox.net>
// 
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
// 
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
// 
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.
//

var scale = 0;
var hiscore = window.localStorage.getItem("net.usebox.submarine.score")||0, score = 0;
var resources = {};

// some utils

function render_text(text) {
	var W = 6, H = 10;
	var map = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!?()@:/'., ";
	var c = document.createElement("canvas");
	c.width = text.length*W;
	c.height = H;
	var ctx = c.getContext("2d");

	ctx.clearRect(0, 0, c.width, c.height);
	for(var i=0; i<text.length; i++) {
		var index = map.indexOf(text.charAt(i));
		ctx.drawImage(resources["font"], index*W, 0, W, H, i*W, 0, W, H); 
	}

	return c;
}


function no_smooth(ctx) {
	// avoid smooth-scaling
	var smoothing = ['imageSmoothingEnabled', 'mozImageSmoothingEnabled', 'webkitImageSmoothingEnabled'];
	smoothing.every(function(element, index, array) {
		if(ctx[element]) {
			ctx[element] = false;
			return false;
		}
		return true;
	});
};

var Loader = function(width, height, cb_done) {
	var self = { 
		width: width,
		height: height,
		cb_done: cb_done,
		count: 0,
		total: 2
	};

	self.init = function() {
		var src = {
			title: "img/title.png",
			font: "img/font.png"
		};

		for(s in src) {
			resources[s] = new Image();
			resources[s].src = src[s];
			resources[s].onload = function() { self.count++; if(self.count == self.total) { self.cb_done(); }};
		}
	};

	self.draw = function(ctx) {
		ctx.save();
		ctx.fillStyle = "rgb(66, 66, 66)";
		ctx.fillRect(20, Math.floor(self.height/2)-5, self.width-40, 10);
		ctx.fillStyle = "rgb(0, 0, 128)";
		ctx.fillRect(21, Math.floor(self.height/2)-4, Math.floor((self.count*(self.width-42))/self.total), 8);
		ctx.restore();
	};

	self.init();
	return self;
};


// main game object

var Game = function(id) {
	var self = {
		id : id,
		canvas : undefined,
		ctx : undefined,
		buffer : undefined,
		bctx : undefined,

		width : 240,
		height : 240,

		state: "loading",
		paused : false,

		then : 0
	};

	self.init = function() {
		self.canvas = document.getElementById(self.id);
		if(!self.canvas.getContext) {
			self.canvas.insertAdjacentHTML("afterend", "<p>This game requires canvas 2D support in your browser :(</p>");
			return undefined;
		}

		self.canvas.style.background = "rgb(33, 22, 64)";

		self.buffer = document.createElement("canvas");
		self.buffer.width = self.width;
		self.buffer.height = self.height;
		self.buffer.style.background = "rgb(33, 22, 64)";

		self.ctx = self.canvas.getContext("2d");
		self.bctx = self.buffer.getContext("2d");

		// requires self.ctx!
		self.onresize();

		document.addEventListener("keydown", self.key_down, false);
		document.addEventListener("keyup", self.key_up, false);

		window.onresize = self.onresize;

		self.loader = Loader(self.width, self.height, self.loading_done);

		return self;
	};

	self.onresize = function() {
		var factor = window.innerHeight/self.height;
		scale = Math.floor(factor);
		self.canvas.width = self.width*scale;
		self.canvas.height = self.height*scale;

		// after scaling, smooth will be back!
		no_smooth(self.ctx);
	};

	self.loading_done = function() {
		resources["hi-score"] = render_text("hi-score: " + hiscore);
		resources["paused"] = render_text("P A U S E D");
		resources["resume"] = render_text("(press 'p' to resume)");
		resources["start"] = render_text("Press 's' to Start!");
		resources["how-to"] = render_text("(use the arrows to move, 'z' to fire)");
		resources["by"] = render_text("A game by @reidrac for LD 29");
		self.state = "menu";
	};

	self.draw_menu = function(ctx) {
		ctx.drawImage(resources["title"], 0, 0);
		ctx.drawImage(resources["hi-score"], self.width/2-Math.floor(resources["hi-score"].width/2), 4);
		ctx.drawImage(resources["start"], self.width/2-Math.floor(resources["start"].width/2), 80);
		ctx.drawImage(resources["how-to"], self.width/2-Math.floor(resources["how-to"].width/2), 92);
		ctx.drawImage(resources["by"], self.width/2-Math.floor(resources["by"].width/2), self.height-16);
	};

	self.draw_paused = function(ctx) {
		ctx.save();
		ctx.fillStyle = "rgba(66, 66, 66, 0.8)";
		ctx.fillRect(0, 0, self.width, self.height);
		ctx.drawImage(resources["paused"], self.width/2-Math.floor(resources["paused"].width/2), self.height/2-8);
		ctx.drawImage(resources["resume"], self.width/2-Math.floor(resources["resume"].width/2), self.height/2+8);
		ctx.restore();
	};

	self.draw = function() {
		self.bctx.clearRect(0, 0, self.width, self.height);

		switch(self.state) {
			case "loading":
				self.loader.draw(self.bctx);
			break;
			case "menu":
				// window.localStorage.setItem("net.usebox.submarine.score", score.toString());
				self.draw_menu(self.bctx);
			break;
			default:
				if(self.paused) {
					self.draw_paused(self.bctx);
				}
			break;
		};

		self.ctx.clearRect(0, 0, self.width*scale, self.height*scale);
		self.ctx.drawImage(self.buffer, 0, 0, self.width, self.height, 0, 0, self.width*scale, self.height*scale);
	};

	self.update = function(dt) {
		if(self.paused) {
			return;
		}
	};

	self.loop = function(now) {
		var dt = Math.min(1000/60, now-self.then);
		self.update(dt/1000);
		self.draw();
		self.then = now;

		requestAnimationFrame(self.loop);
	};

	self.key_down = function(event) {
		switch(self.state) {
			case "loading":
			break;
			case "menu":
			break;
			default:
				if(event.keyCode == 80) {
					self.paused = !self.paused;
					return;
				}
			break;
		};
	};

	self.init();
	return self;
};

window.onload = function () {
	var game = Game("submarine");
	if(game != undefined) {
		game.loop();
	}
};


