from typing import List, Dict, Tuple
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from fastapi.middleware.cors import CORSMiddleware
import os
import json

Tile = str
Grid = List[List[Tile]]

class Track(BaseModel):
	id: str
	name: str
	grid: Grid = Field(description="2D grid per problem statement")

class TrackListResponse(BaseModel):
	tracks: List[Track]

class ValidateResponse(BaseModel):
	valid: bool
	message: str

class SolveRequest(BaseModel):
	grid: Grid

class SolveResponse(BaseModel):
	moves: List[str]

app = FastAPI(title="Car Game Backend")

# Configure CORS (update allowed origins during development)
app.add_middleware(
	CORSMiddleware,
	allow_origins=[
		"http://localhost:5173",
		"http://127.0.0.1:5173",
	],
	allow_credentials=True,
	allow_methods=["*"],
	allow_headers=["*"],
)


def _validate_grid(grid: Grid) -> Tuple[bool, str]:
	if not grid or not grid[0]:
		return False, "Grid must be non-empty"

	rows = len(grid)
	cols = len(grid[0])
	for row in grid:
		if len(row) != cols:
			return False, "All rows must have equal length"

	# Allowed tokens
	allowed_prefixes = {"0", "1", "S", "F", "T"}

	# Validate tokens and collect teleport counts
	teleport_counts: Dict[str, int] = {}
	start_count = 0
	flag_count = 0

	for r in range(rows):
		for c in range(cols):
			cell = str(grid[r][c]).strip()
			if not cell:
				return False, f"Empty cell at ({r},{c})"
			head = cell[0]
			if head not in allowed_prefixes:
				return False, f"Invalid token '{cell}' at ({r},{c})"
			if cell == "S":
				start_count += 1
			elif cell == "F":
				flag_count += 1
			elif head == "T":
				teleport_counts[cell] = teleport_counts.get(cell, 0) + 1
			elif cell not in {"0", "1"}:  # ensure only 0 or 1 are other bare tokens
				return False, f"Invalid token '{cell}' at ({r},{c})"

	if start_count != 1:
		return False, "There must be exactly one start 'S'"
	if flag_count < 1:
		return False, "There must be at least one flag 'F'"

	# Each teleport must occur exactly twice
	for t, count in teleport_counts.items():
		if count != 2:
			return False, f"Teleport {t} must appear exactly twice (found {count})"

	return True, "OK"


def _load_tracks_from_json(path: str) -> List[Track]:
	with open(path, "r") as f:
		data = json.load(f)
	items = data.get("tracks", [])
	tracks: List[Track] = []
	for item in items:
		track = Track(
			id=str(item["id"]),
			name=str(item.get("name", item["id"])),
			grid=item["grid"],
		)
		ok, msg = _validate_grid(track.grid)
		if not ok:
			raise RuntimeError(f"Invalid track '{track.id}': {msg}")
		tracks.append(track)
	return tracks


# Load and validate tracks from JSON at startup
_tracks_json_path = os.path.join(os.path.dirname(__file__), "tracks.json")
_validated: List[Track] = _load_tracks_from_json(_tracks_json_path)


@app.get("/api/tracks", response_model=TrackListResponse)
async def list_tracks() -> TrackListResponse:
	return TrackListResponse(tracks=_validated)


class ValidateRequest(BaseModel):
	grid: Grid


@app.post("/api/validate", response_model=ValidateResponse)
async def validate_track(req: ValidateRequest) -> ValidateResponse:
	ok, msg = _validate_grid(req.grid)
	return ValidateResponse(valid=ok, message=msg)


@app.post("/api/solve", response_model=SolveResponse)
async def solve_track(req: SolveRequest) -> SolveResponse:
	from .algo import solve_grid_to_moves
	ok, msg = _validate_grid(req.grid)
	if not ok:
		raise HTTPException(status_code=400, detail=msg)
	try:
		moves = solve_grid_to_moves(req.grid)
		return SolveResponse(moves=moves)
	except ValueError as e:
		raise HTTPException(status_code=400, detail=str(e))


@app.get("/healthz")
async def health() -> Dict[str, str]:
	return {"status": "ok"}


if __name__ == "__main__":
	import uvicorn
	uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
