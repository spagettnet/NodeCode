class NBoard {
	constructor(env, name) {
		console.log("Created board " + name);
		this.env = env;
		env.boardCount += 1;
		this.name = name;
		this.id = "maintab-" + env.boardCount;
		this.zoomCounter = 0;
		this.displayOffset = new NPoint(0, 0);
		this.zoom = 1;
		this.paneDiv = null;
		this.boardDiv = null;
		this.canvasDiv = null;
		this.containerDiv = null;

		this.nodes = {}; // nodeid : node
		this.selectedNodes = {};
		this.pins = {}; // pinid : pin

		this.links = {}; // (pin1, (pin2|null))

		this.actionStack = [];
		this.actionStackIndex = -1;
		this.execIterCount = 0;

		this.draggedNodes = null;
		this.draggedPin = null;
		this.selectionBox = null;
		this.sboxMin = new NPoint(0, 0);
		this.sboxMax = new NPoint(0, 0);
		this.dragPanID = null;

		this.boundRect = null;
		this.rectDims = new NPoint(0, 0);
		this.cvOffset = new NPoint(0, 0);

		// mouse stuff
		this.leftMDown = false;
		this.rightMDown = false;
		this.lastMouseButton = -1;
		this.clickStartTarget = null;
		this.clickEndTarget = null;
		this.clickStart = new NPoint(0, 0);
		this.clickEnd = new NPoint(0, 0);
		this.clickDelta = new NPoint(0, 0);
		this.clickDistance = 0;
		this.lastMousePosition = new NPoint(0, 0);
		this.currentMouse = new NPoint(0, 0);
		this.trueCurrentMouse = new NPoint(0, 0);
		this.frameMouseDelta = new NPoint(0, 0);
	}

	evntToPt(event) {
		const p = new NPoint(event.clientX, event.clientY).subtract2(25, 60).subtractp(this.displayOffset).divide1(this.zoom);
		return p;
	}

	evntToPtBrd(event) {
		const p = new NPoint(event.clientX, event.clientY).subtract2(25, 60);
		return p;
	}

	makeSelectionBox(point) {
		if (this.selectionBox == null) {
			this.sBoxContainer = document.createElement("div");
			this.sBoxContainer.className = "container";
			this.selectionBox = document.createElement("div");
			this.selectionBox.className = "selectbox";
			if (this.env.altDown) {
				this.selectionBox.setAttribute('anti', true);
			}
			this.sBoxContainer.append(this.selectionBox);
			this.containerDiv.append(this.sBoxContainer);
		}
	}

	destroySelectionBox() {
		if (this.selectionBox != null) {
			this.selectionBox = null;
			this.sBoxContainer.remove();
			this.sBoxContainer = null;
		}
	}

	dragPanLogic() {
		const topEdgeDist = this.trueCurrentMouse.y - this.boundRect.top;
		const bottomEdgeDist = this.boundRect.bottom - this.trueCurrentMouse.y;
		const leftEdgeDist = this.trueCurrentMouse.x - this.boundRect.left;
		const rightEdgeDist = this.boundRect.right - this.trueCurrentMouse.x;
		let panned = false;

		if (topEdgeDist < this.env.maxPanDist) {
			this.displayOffset = this.displayOffset.add2(0, (this.env.maxPanDist - topEdgeDist) * this.env.panSpeed);
			panned = true;
		} else if (bottomEdgeDist < this.env.maxPanDist) {
			this.displayOffset = this.displayOffset.add2(0, (bottomEdgeDist - this.env.maxPanDist) * this.env.panSpeed);
			panned = true;
		}
		if (rightEdgeDist < this.env.maxPanDist) {
			this.displayOffset = this.displayOffset.add2((rightEdgeDist - this.env.maxPanDist) * this.env.panSpeed, 0);
			panned = true;
		} else if (leftEdgeDist < this.env.maxPanDist) {
			this.displayOffset = this.displayOffset.add2((this.env.maxPanDist - leftEdgeDist) * this.env.panSpeed, 0);
			panned = true;
		}

		// fake a mouse move event to ensure things keep happening even if the mouse isn't moving
		this.mouseMoved(this.lastMouseMoveEvent);
		this.redraw();
	}

	mouseDown(event) {
		this.lastMouseButton = event.which;
		this.clickStart = this.evntToPt(event);
		this.clickStartTarget = event.target;
		this.clickDistance = 0;

		// start ticking for screen edge panning
		this.dragPanID = setInterval(this.dragPanLogic.bind(this), 50);

		switch (event.which) {
			// Left mouse button
			case 1:
				{
					this.leftMDown = true;
					break;
				}
			case 2:
				{
					break;
				}
			case 3:
				{
					this.rightMDown = true;
				}
		}
		this.redraw();
		return true;
	}

	mouseUp(event) {
		const button = event.which;
		// Left mouse button
		this.clickEnd = this.evntToPt(event);
		this.clickDelta = this.clickEnd.subtractp(this.clickStart);
		this.clickEndTarget = event.target;

		// stop ticking for screen edge panning
		clearInterval(this.dragPanID);

		switch (button) {
			case 1: // LEFT MOUSE
				{
					this.leftMDown = false;

					if(this.selectionBox){ // finish selection box
						// next 40ish lines are selection logic...
						if (this.env.altDown) { // deselect things in box
							const deselectedNodes = [];
							for (const nodeid in this.selectedNodes) {
								const node = this.nodes[nodeid];
								if (node.within(this.sboxMin, this.sboxMax)) {
									deselectedNodes.push(node);
									this.deselectNode(node);
								}
							}
							if (deselectedNodes.length > 0) {
								this.addAction(new ActDeselect(this, deselectedNodes));
							}
						} else {
							const selectedNodes = [];
							for (const nodeid in this.nodes) {
								const node = this.nodes[nodeid];
								if (node.within(this.sboxMin, this.sboxMax)) {
									selectedNodes.push(node);
								}
							}

							if (selectedNodes.length > 0) {
								if (this.env.shiftDown) {
									this.addAction(new ActSelect(this, selectedNodes));
								} else {
									this.addAction(new NMacro(new ActDeselectAll(this), new ActSelect(this, selectedNodes)));
								}
							} else {
								if (!this.env.shiftDown) {
									this.addAction(new ActDeselectAll(this));
								}
							}

							// deselect all if shift isn't down
							if (!this.env.shiftDown) {
								this.deselectAllNodes();
							}

							for (const node of selectedNodes) {
								this.selectNode(node);
							}
						}
						this.destroySelectionBox();
					}else if(this.draggedNode){ // finish moving node(s)
						this.draggedNode = this.getDivNode(this.clickStartTarget);
						if (this.draggedNode.selected) {
							this.addAction(new ActMoveSelectedNodes(this, this.clickDelta));
						} else {
							this.addAction(new ActMoveNodes(this, this.clickDelta, [this.draggedNode]));
						}
						this.draggedNode = null;
					}else if(this.draggedPin){ // finish dragging pin
						this.boardDiv.removeAttribute("linking");
						this.draggedPin.pinDiv.removeAttribute("linking");
						for(const nodeid in this.nodes){
							const node = this.nodes[nodeid];
							if(this.draggedPin.side){
								for(const pinid in node.inpins){
									node.inpins[pinid].pinDiv.removeAttribute("match");
								}
							}else{
								for(const pinid in node.outpins){
									node.outpins[pinid].pinDiv.removeAttribute("match");
								}
							}
						}
						// successful link
						if (this.clickEndTarget.classList.contains("pin")) {
							const lank = this.draggedPin.linkTo(this.getDivPin(this.clickEndTarget));
						}
						delete this.links[this.draggedPin.pinid];
						this.draggedPin = null;
					}else if(this.clickDistance > this.env.dragDistance){ // something unknown was dragged

					}else{ // nothing was dragged - click occured
						const upTargetClasses = this.clickStartTarget.classList;

						if (this.clickStartTarget == this.boardDiv) { // board clicked
							if (Object.keys(this.selectedNodes).length > 0) {
								this.addAction(new ActDeselectAll(this));
								this.deselectAllNodes();
							}
						} else if (upTargetClasses.contains("nodepart")) { // a node was clicked
							const divNode = this.getDivNode(this.clickEndTarget);
							if (this.env.shiftDown) {
								this.addAction(new ActSelect(this, [divNode]));
								this.selectNode(divNode);
							} else if (this.env.altDown) {
								this.addAction(new ActToggleSelect(this, [divNode]));
								this.toggleSelectNode(divNode);
							} else {
								this.addAction(new NMacro(new ActDeselectAll(this), new ActSelect(this, [divNode])));
								this.deselectAllNodes();
								this.selectNode(divNode);
							}
						}
					}
					break;
				}
			case 2: // MIDDLE MOUSE
				{
					break;
				}
			case 3: // RIGHT MOUSE
				{
					this.rightMDown = false;
				}
		}
		this.redraw();
		return false;
	}

	mouseMoved(event) {
		this.lastMouseMoveEvent = event;
		this.currentMouse = this.evntToPt(event);
		this.trueCurrentMouse = new NPoint(event.clientX, event.clientY);
		this.frameMouseDelta = this.currentMouse.subtractp(this.lastMousePosition);
		this.clickDistance += this.frameMouseDelta.lengthSquared();

		if (this.leftMDown) {
			// click & drag in progress?
			if (this.selectionBox) { // currently dragging board (selection box)
				this.sboxMin = NPoint.prototype.min(this.clickStart, this.currentMouse);
				this.sboxMax = NPoint.prototype.max(this.clickStart, this.currentMouse);

				const sboxMin = this.sboxMin;
				const sboxSize = this.sboxMax.subtractp(this.sboxMin);
				this.selectionBox.style.left = sboxMin.x + "px";
				this.selectionBox.style.top = sboxMin.y + "px";
				this.selectionBox.style.width = sboxSize.x + "px";
				this.selectionBox.style.height = sboxSize.y + "px";
			} else if (this.draggedNode) { // currently dragging node(s)
				if (this.draggedNode.selected) { // dragging selected nodes
					for (const sNodeID in this.selectedNodes) {
						const selectedNode = this.selectedNodes[sNodeID];
						selectedNode.move(this.frameMouseDelta);
					}
				} else { // dragging unselected node
					this.draggedNode.move(this.frameMouseDelta);
				}
			} else if (this.draggedPin) { // currently dragging pins
				// only redrawing is required for dragged pin
				this.redraw();

			} else if (this.clickDistance > this.env.dragDistance) { // currently dragging nothing - check if drag has started
				const upTargetClasses = this.clickStartTarget.classList;

				if (this.clickStartTarget == this.boardDiv) { // start selection box
					this.makeSelectionBox(this.clickStart);
				} else if (upTargetClasses.contains("nodepart")) { // start dragging node
					this.draggedNode = this.getDivNode(this.clickStartTarget);
				} else if (upTargetClasses.contains("pin")) { // start dragging pin
					this.draggedPin = this.getDivPin(this.clickStartTarget);
					this.links[this.draggedPin.pinid] = [this.draggedPin, null];
					this.draggedPin.pinDiv.setAttribute("linking", true);
					this.boardDiv.setAttribute("linking", true);
					for(const nodeid in this.nodes){
						const node = this.nodes[nodeid];
						if(this.draggedPin.side){
							for(const pinid in node.inpins){
								const pin = node.inpins[pinid]
								if(this.draggedPin.canPlugInto(pin)){
									pin.pinDiv.setAttribute("match", true);
								}
							}
						}else{
							for(const pinid in node.outpins){
								const pin = node.outpins[pinid]
								if(pin.canPlugInto(this.draggedPin)){
									pin.pinDiv.setAttribute("match", true);
								}
							}
						}
					}
				}
			}
		}

		this.lastMousePosition = this.currentMouse;
		return true;
	}

	mouseWheel(event) {
		if (event.ctrlKey) {
			const prevZoom = this.zoom;
			this.zoomCounter += event.deltaY;
			this.zoomCounter = Math.min(171, Math.max(-219, this.zoomCounter));
			this.zoom = Math.pow(1.0075, -this.zoomCounter);
			this.displayOffset = this.displayOffset.subtractp(this.evntToPtBrd(event).subtractp(this.displayOffset).divide1(prevZoom).multiply1(this.zoom - prevZoom))
		} else {
			this.displayOffset = this.displayOffset.subtract2(event.deltaX, event.deltaY);
		}
		this.redraw();
		return false;
	}

	keyPressed(event) {
		switch (event.key) {
			case 'Alt':
				if (this.selectionBox) {
					this.selectionBox.setAttribute('anti', true);
				}
				break;
		}
		switch (event.which) {
			case 90:
				if (this.env.ctrlDown) {
					if (this.env.shiftDown) {
						this.redo();
					} else {
						this.undo();
					}
				}
				break;
			case 65:
				if (main.ctrlDown) {
					this.addAction(new ActSelectAll(this));
					main.activeBoard.selectAllNodes();
				}
				break;
			case 187:
				if (main.ctrlDown) {
					const prevZoom = this.zoom;
					if (this.zoom < 5) {
						this.zoom *= 1.2;
					}
					this.redraw();
				}
				break;
			case 189:
				if (main.ctrlDown) {
					const prevZoom = this.zoom;
					if (this.zoom > 0.28) {
						this.zoom *= 0.8333333;
					}
					this.redraw();
				}
				break;
		}
	}

	redraw() {
		this.redraw();
	}

	undo() {
		if (this.actionStackIndex == -1) {
			return;
		}
		this.actionStack[this.actionStackIndex].undo();
		this.actionStackIndex--;
	}

	redo() {
		if (this.actionStackIndex == this.actionStack.length - 1) {
			return;
		}
		this.actionStackIndex++;
		this.actionStack[this.actionStackIndex].redo();
	}

	keyReleased(event) {
		switch (event.key) {
			case 'Alt':
				if (this.selectionBox) {
					this.selectionBox.removeAttribute('anti');
				}
				break;
		}
	}

	scrolled(event) {
		this.displayOffset = this.displayOffset.add2(event.deltaX, event.deltaY);
	}

	addAction(action) {
		this.actionStackIndex++;
		this.actionStack = this.actionStack.slice(0, this.actionStackIndex);
		this.actionStack.push(action);
	}

	// returns a nodepart div's node
	getDivNode(div) {
		return this.nodes[div.getAttribute("data-nodeid")];
	}

	// returns a pin/pinfo div's pin
	getDivPin(div) {
		return this.pins[div.getAttribute("data-pinid")];
	}

	selectNode(node) {
		if (!node.selected) {
			node.nodeDiv.setAttribute("selected", "");
			node.selected = true;
			this.selectedNodes[node.nodeid] = node;
		}
	}

	deselectNode(node) {
		if (node.selected) {
			node.nodeDiv.removeAttribute("selected");
			node.selected = false;
			delete this.selectedNodes[node.nodeid];
		}
	}

	selectAllNodes() {
		for (const nodeid in this.nodes) {
			this.selectNode(this.nodes[nodeid]);
		}
	}

	deselectAllNodes() {
		for (const nodeid in this.selectedNodes) {
			const node = this.selectedNodes[nodeid];
			node.nodeDiv.removeAttribute("selected");
			node.selected = false;
		}
		this.selectedNodes = {};
	}

	toggleSelectNode(node) {
		if (node.selected) {
			this.deselectNode(node);
		} else {
			this.selectNode(node);
		}
	}

	fixSize() {
		const h = window.innerHeight - 90;
		const w = window.innerWidth - 52;
		this.paneDiv.width = w;
		this.paneDiv.height = h;
		this.boundRect = this.boardDiv.getBoundingClientRect();
		this.rectDims = new NPoint(this.boundRect.width, this.boundRect.height);
		this.canvasDiv.width = this.rectDims.x;
		this.canvasDiv.height = this.rectDims.y;
		this.cvOffset = divPos(this.canvasDiv);
		this.redraw();
	}

	createTabDiv() {
		if (this.tabDiv != null) {
			return null;
		}

		this.tabDiv = document.createElement("li");
		this.tabDiv.className = "tab";

		const link = document.createElement("a");
		link.innerHTML = this.name;
		link.setAttribute("href", "#" + this.id);

		this.tabDiv.append(link);
		return this.tabDiv;
	}

	createPaneDiv() {
		if (this.paneDiv != null) {
			return null;
		}

		this.paneDiv = document.createElement("div");
		this.paneDiv.className = "tabpane";
		this.paneDiv.id = this.id;
		let brd = this;

		this.boardDiv = document.createElement("div");
		this.boardDiv.className = "board";
		this.paneDiv.append(this.boardDiv);

		this.containerDiv = document.createElement("div");
		this.containerDiv.className = "container";
		this.boardDiv.append(this.containerDiv);

		this.canvasDiv = document.createElement("canvas");
		this.boardDiv.append(this.canvasDiv);

		this.redraw();

		return this.paneDiv;
	}

	redraw() {
		window.requestAnimationFrame(this.draw.bind(this));
	}

	draw() {
		const ctx = this.canvasDiv.getContext("2d");
		// clear canvas
		ctx.save();
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.clearRect(0, 0, this.canvasDiv.width, this.canvasDiv.height);
		ctx.restore();

		// update transform
		this.containerDiv.style.transform = "translate3d(" + this.displayOffset.x + "px, " + this.displayOffset.y + "px, 0px) scale(" + this.zoom + ")";

		for (const linkid in this.links) {
			const link = this.links[linkid];
			let pinA = link[0];
			let pinB = link[1];
			let l1;
			let l2;
			let c1;
			let c2;
			if (pinA == null) {
				if (pinB == null) {
					console.log("Attempted to draw link with 2 null pins");
				} else {
					if (pinB.side) {
						l1 = this.currentMouse.multiply1(this.zoom).addp(this.displayOffset);
						l2 = divCenter(pinB.pinDiv).subtractp(this.cvOffset);
						c1 = NObject.color + "44";
						c2 = pinB.color;
					} else {
						l1 = divCenter(pinB.pinDiv).subtractp(this.cvOffset);
						l2 = this.currentMouse.multiply1(this.zoom).addp(this.displayOffset);
						c1 = pinB.color;
						c2 = NObject.color + "44";
					}
				}
			} else {
				if (pinB == null) {
					if (pinA.side) {
						l2 = divCenter(pinA.pinDiv).subtractp(this.cvOffset);
						l1 = this.currentMouse.multiply1(this.zoom).addp(this.displayOffset);
						c1 = NObject.color + "44";
						c2 = pinA.color;
					} else {
						l1 = divCenter(pinA.pinDiv).subtractp(this.cvOffset);
						l2 = this.currentMouse.multiply1(this.zoom).addp(this.displayOffset);
						c1 = pinA.color;
						c2 = NObject.color + "44";
					}
				} else {
					if (pinA.side) {
						l1 = divCenter(pinB.pinDiv).subtractp(this.cvOffset);
						l2 = divCenter(pinA.pinDiv).subtractp(this.cvOffset);
						c1 = pinB.color;
						c2 = pinA.color;
					} else {
						l1 = divCenter(pinA.pinDiv).subtractp(this.cvOffset);
						l2 = divCenter(pinB.pinDiv).subtractp(this.cvOffset);
						c1 = pinA.color;
						c2 = pinB.color;
					}
				}
			}
			const grad = ctx.createLinearGradient(l1.x, l1.y, l2.x, l2.y);
			grad.addColorStop("0", c1);
			grad.addColorStop("1.0", c2);

			ctx.strokeStyle = grad;
			ctx.lineWidth = 8 * this.zoom;

			ctx.beginPath();
			ctx.moveTo(l1.x, l1.y);
			const splineDist = Math.abs(l1.y - l2.y) / 2 + Math.abs((l1.x - l2.x)) / 4;
			ctx.bezierCurveTo(l1.x - splineDist, l1.y, l2.x + splineDist, l2.y, l2.x, l2.y);
			ctx.stroke();
		}
	}

	addNode(type) {
		const node = new type();
		node.board = this;
		const d = node.createNodeDiv();
		this.containerDiv.append(d);
		this.nodes[node.nodeid] = node;
		return node;
	}
}