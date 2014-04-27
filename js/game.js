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

var scale = 0, bg_offset;
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
		if(index>=0) {
			ctx.drawImage(resources["font"], index*W, 0, W, H, i*W, 0, W, H); 
		} else {
			console.log("ERROR: " + text.charAt(i) + " not in map, from: " + text);
		}
	}

	return c;
}

function random(min, max) {
	return Math.floor(Math.random()*(max-min))+min;
}

function pad(number, digits) {
	return Array(Math.max(digits - String(number).length + 1, 0)).join(0) + number;
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

function draw_frame(ctx, base, frame, x, y, w, h) {
	w = w||32;
	h = h||32;
	ctx.drawImage(base, frame*w, 0, w, h, Math.floor(x), Math.floor(y), w, h);
}

var Loader = function(width, height, cb_done) {
	var self = { 
		width: width,
		height: height,
		cb_done: cb_done,
		count: 0,
		total: 7
	};

	self.init = function() {
		var src = {
			mine: "img/mine.png",
			bottom: "img/bottom.png",
			torpedo_hud: "img/torpedo-hud.png",
			torpedo: "img/torpedo.png",
			sub: "img/submarine.png",
			wline: "img/water-line.png",
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

var Torpedo = function(x, y, dir) {
	var self = {
		x : x,
		y : y, 
		incx : dir == 0 ? 1 : -1,
		delay : 0,
		base : dir == 0 ? 0 : 2,
		frame : 0,
		alive : true
	};

	if(dir == 0) {
		self.x += 30;
	} else {
		self.x -= 20;
	}

	self.update = function(dt) {
		if(!self.alive) {
			return;
		}

		if(self.delay < 0.1) {
			self.delay += dt;
		} else {
			self.delay = 0;
			self.frame = self.frame ? 0 : 1;
		}

		self.x += self.incx*dt*164;
		if(self.x < -32 || self.x>272) {
			self.alive = false;
		}
	};

	self.draw = function(ctx) {
		if(self.alive) {
			draw_frame(ctx, resources["torpedo"], self.base+self.frame, self.x, self.y, 23);
		}
	};

	return self;
};

var Mine = function(x, y) {
	var self = {
		x : x,
		y : y, 
		offset : 0,
		alive : true
	};

	self.y = Math.floor(self.y/32)*32;
	// FIXME: harcoded values
	self.chains = (240-self.y)/32;

	self.update = function(dt) {

	};

	self.draw = function(ctx) {
		if(self.alive) {
			draw_frame(ctx, resources["mine"], 0, self.x+self.offset+bg_offset, self.y);
			var i;
			for(i=1; i<self.chains; i++) {
				draw_frame(ctx, resources["mine"], 1, self.x+self.offset+bg_offset, self.y+i*32);
			}
		}
	};

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

		delay : 0,
		up : false,
		down : false,
		left : false,
		right : false,
		fire : false,

		dt : 0,
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
		resources["hi-score"] = render_text("hi score: " + hiscore);
		resources["paused"] = render_text("P A U S E D");
		resources["resume"] = render_text("(press 'p' to resume)");
		resources["start"] = render_text("Press 's' to Start!");
		resources["how-to"] = render_text("(use the arrows to move, 'z' to fire)");
		resources["by"] = render_text("A game by @reidrac for LD 29");

		self.x = self.width/2-16;
		self.y = 165;

		self.state = "menu";
	};

	self.draw_menu = function(ctx, no_transition) {
		ctx.drawImage(resources["title"], 0, 0);
		ctx.drawImage(resources["hi-score"], self.width/2-Math.floor(resources["hi-score"].width/2), 4);
		ctx.drawImage(resources["start"], self.width/2-Math.floor(resources["start"].width/2), 80);
		ctx.drawImage(resources["how-to"], self.width/2-Math.floor(resources["how-to"].width/2), 92);
		ctx.drawImage(resources["by"], self.width/2-Math.floor(resources["by"].width/2), self.height-16);
		if(no_transition == undefined) {
			draw_frame(ctx, resources["sub"], 0, self.x, self.y);
			draw_frame(ctx, resources["wline"], 0, self.width/2-16, 165);
		}
	};

	self.draw_transition = function(ctx) {
		ctx.drawImage(resources["snapshot"], 0, 0, self.width, self.height, 0, Math.floor(self.trans_y), self.width, self.height);
		draw_frame(ctx, resources["sub"], 0, self.x, Math.floor(self.y));
	};

	self.draw_paused = function(ctx) {
		ctx.save();
		ctx.fillStyle = "rgba(66, 66, 66, 0.8)";
		ctx.fillRect(0, 0, self.width, self.height);
		ctx.drawImage(resources["paused"], self.width/2-Math.floor(resources["paused"].width/2), self.height/2-8);
		ctx.drawImage(resources["resume"], self.width/2-Math.floor(resources["resume"].width/2), self.height/2+8);
		ctx.restore();
	};

	self.draw_play = function(ctx) {
			self.items.forEach(function(i) {
				i.draw(ctx);
			});

			// bottom of the sea
			var offset = Math.floor(self.bg_offset);
			ctx.drawImage(resources["bottom"], offset, self.height-16);
			ctx.drawImage(resources["bottom"], offset-self.width*2, self.height-16);
			ctx.drawImage(resources["bottom"], offset+self.width*2, self.height-16);

			draw_frame(ctx, resources["sub"], self.frame, self.x, self.y);

			// HUD
			var i;
			for(i=0; i<self.ntorpedoes; i++) {
				ctx.drawImage(resources["torpedo_hud"], 4+i*resources["torpedo_hud"].width, 4, resources["torpedo_hud"].width, resources["torpedo_hud"].height);
			}
			ctx.drawImage(resources["score"], self.width-resources["score"].width-4, 4);
	};

	self.update_score = function(score) {
		resources["score"] = render_text(pad(score, 6));
		self.score = score;
	};

	self.draw = function main_draw() {

		switch(self.state) {
			case "loading":
				self.bctx.clearRect(0, 0, self.width, self.height);
				self.loader.draw(self.bctx);
				self.ctx.clearRect(0, 0, self.width*scale, self.height*scale);
			break;
			case "menu":
				// window.localStorage.setItem("net.usebox.submarine.score", score.toString());
				self.draw_menu(self.bctx);
			break;
			case "transition":
				self.bctx.clearRect(0, 0, self.width, self.height);
				self.draw_transition(self.bctx);
				self.ctx.clearRect(0, 0, self.width*scale, self.height*scale);
			break;
			case "play":
				self.bctx.clearRect(0, 0, self.width, self.height);
				self.draw_play(self.bctx);
				if(self.paused) {
					self.draw_paused(self.bctx);
				}
				self.ctx.clearRect(0, 0, self.width*scale, self.height*scale);
			break;
		};

		self.ctx.drawImage(self.buffer, 0, 0, self.width, self.height, 0, 0, self.width*scale, self.height*scale);
	};

	self.update = function update(dt) {
		if(self.paused) {
			return;
		}

		switch(self.state) {
			case "menu":
				self.delay += dt;
				if(self.delay > 1) {
					self.y = self.y == 165 ? 166 : 165;
					self.delay = 0;
				}
			break;
			case "transition":
				if(self.y > self.height/2) {
					self.y -= dt*60;
				}
				if(self.trans_y > -self.height) {
					self.trans_y -= dt*180;
				} else {
					self.items = [];
					self.items.push(Mine(40, random(self.width/2, self.width-32)));

					self.bg_offset = 0;
					self.y = Math.floor(self.y);
					self.ntorpedoes = 10;
					self.update_score(0);
					self.cool_down = 0;
					self.turn = false;
					self.turn_dir = 0;
					self.turn_delay = 0;
					self.frame = 0;
					self.incx = 0;
					self.incy = 0;
					self.up = false;
					self.down = false;
					self.left = false;
					self.right = false;
					self.fire = false;
					self.state = "play";
				}
			break;
			case "play":
				var MAX = 160;

				// update world offset
				bg_offset = Math.floor(self.bg_offset);

				self.items = self.items.filter(function(t) {
					if(t.alive) {
						t.update(dt);
					}
					return t.alive;
				});

				if(self.up) {
					self.incy = Math.max(-MAX, self.incy-10);
				}
				if(self.down) {
					self.incy = Math.min(MAX, self.incy+10);
				}
				if(self.left) {
					self.incx = Math.max(-MAX, self.incx-10);
				}
				if(self.right) {
					self.incx = Math.min(MAX, self.incx+10);
				}

				if(!self.left && !self.right) {
					if(self.incx > 0) {
						self.incx = Math.max(0, self.incx-5);
					}
					if(self.incx < 0) {
						self.incx = Math.min(0, self.incx+5);
					}
				}
				if(!self.up && !self.down) {
					if(self.incy > 0) {
						self.incy = Math.max(0, self.incy-5);
					}
					if(self.incy < 0) {
						self.incy = Math.min(0, self.incy+5);
					}
				}

				if((self.incx<0 && self.frame==0) || (self.incx>0 && self.frame==2)) {
					self.frame = 1;
					self.turn = true;
					self.turn_dir = self.incx<0 ? 2 : 0;
					self.turn_delay = 0;
				}

				if(self.turn && self.turn_delay < 0.2) {
					self.turn_delay += dt;
				} else {
					self.turn = false;
					self.frame = self.turn_dir;
				}

				if(self.x+self.incx*dt > 32 && self.x+self.incx*dt < self.width-64) { 
					self.x += self.incx*dt;
				} else {
					self.bg_offset += -self.incx*dt;
					if(self.bg_offset > self.width*2) {
						self.bg_offset -= self.width*2;
						self.items.forEach(function(t) {
							if(t.offset != undefined) {
								if(self.bg_offset >= self.width) {
									t.offset = -self.width;
								} else {
									t.offset = self.x-self.width;
								}
							}
						});
					}
					if(self.bg_offset < -self.width*2) {
						self.bg_offset += self.width*2;
						self.items.forEach(function(t) {
							if(t.offset != undefined) {
								if(self.bg_offset <= 0) {
									t.offset = self.width;
								} else {
									t.offset = 0;
								}
							}
						});
					}
				}
				if(self.y+self.incy*dt > 16 && self.y+self.incy*dt < self.height-48) { 
					self.y += self.incy*dt;
				}

				self.cool_down = Math.max(0, self.cool_down-dt);
				if(self.ntorpedoes > 0 && self.cool_down == 0 && self.fire && self.frame != 1) {
					self.cool_down = 0.8;
					self.items.push(Torpedo(self.x, self.y, self.frame));
					self.ntorpedoes--;
				}

			break
		};

	};

	self.loop = function loop(now) {
		self.dt += Math.min(1000/30, now-self.then)||0;
		while(self.dt >= 1000/80) {
			self.update(1/80);
			self.dt -= 1000/80;
		}
		self.draw();
		self.then = now;

		requestAnimationFrame(self.loop);
	};

	self.key_down = function(event) {
		switch(self.state) {
			case "menu":
				if(event.keyCode == 83) {
					var c = document.createElement("canvas");
					c.width = self.width;
					c.height = self.height;
					var ctx = c.getContext("2d");
					ctx.clearRect(0, 0, c.width, c.height);
					self.draw_menu(ctx, false);
					resources["snapshot"] = c;
					self.trans_y = 0;
					self.state = "transition";
				}
			break;
			case "play":
				if(event.keyCode == 80) {
					self.paused = !self.paused;
					return;
				}

				if(event.keyCode == 38) {
					self.up = true;
				}
				if(event.keyCode == 39) {
					self.right = true;
				}
				if(event.keyCode == 40) {
					self.down = true;
				}
				if(event.keyCode == 37) {
					self.left = true;
				}
				if(event.keyCode == 90) {
					self.fire = true;
				}
			break;
		};
	};

	self.key_up = function(event) {
		if(self.state == "play") {
			if(event.keyCode == 38) {
				self.up = false;
			}
			if(event.keyCode == 39) {
				self.right = false;
			}
			if(event.keyCode == 40) {
				self.down = false;
			}
			if(event.keyCode == 37) {
				self.left = false;
			}
			if(event.keyCode == 90) {
				self.fire = false;
			}
		}
	};

	self.init();
	return self;
};

window.onload = function () {
	var game = Game("submarine");
	if(game != undefined) {
		game.loop(0);
	}
};


