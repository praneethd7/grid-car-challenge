from typing import Deque, Dict, List, Optional, Tuple
from collections import deque

# Local types (avoid importing from main to prevent circular imports)
Tile = str
Grid = List[List[Tile]]

Position = Tuple[int, int]


def _is_drivable(cell: Tile) -> bool:
	return cell != "0"


def _find_key_points(grid: Grid) -> Tuple[Position, List[Position], Dict[str, List[Position]]]:
	start: Optional[Position] = None
	flags: List[Position] = []
	teleports: Dict[str, List[Position]] = {}
	for r in range(len(grid)):
		for c in range(len(grid[0])):
			cell = str(grid[r][c])
			if cell == "S":
				start = (r, c)
			elif cell == "F":
				flags.append((r, c))
			elif cell.startswith("T"):
				teleports.setdefault(cell, []).append((r, c))
	if start is None:
		raise ValueError("Grid missing start 'S'")
	return start, flags, teleports


def _teleport_partner_map(teleports: Dict[str, List[Position]]) -> Dict[Position, Position]:
	partner: Dict[Position, Position] = {}
	for label, points in teleports.items():
		if len(points) != 2:
			raise ValueError(f"Teleport {label} must appear exactly twice")
		a, b = points
		partner[a] = b
		partner[b] = a
	return partner


def _in_bounds(r: int, c: int, grid: Grid) -> bool:
	return 0 <= r < len(grid) and 0 <= c < len(grid[0])



def _zero_one_bfs(grid: Grid, src: Position, partner: Dict[Position, Position]) -> Tuple[Dict[Position, int], Dict[Position, Tuple[Position, str]]]:
	# Uniform-cost BFS where stepping into a teleport immediately yields its partner.
	# Resulting path labels only include U/D/L/R, never 'T'.
	dist: Dict[Position, int] = {}
	parent: Dict[Position, Tuple[Position, str]] = {}
	q: Deque[Position] = deque()
	INF = 10 ** 9

	# Initialize distances
	for r in range(len(grid)):
		for c in range(len(grid[0])):
			if _is_drivable(str(grid[r][c])):
				dist[(r, c)] = INF

	dist[src] = 0
	q.append(src)

	# Directions
	dirs = [(-1, 0, 'U'), (1, 0, 'D'), (0, -1, 'L'), (0, 1, 'R')]

	while q:
		u = q.popleft()
		u_r, u_c = u

		# 1-cost adjacent moves
		for dr, dc, mv in dirs:
			vr, vc = u_r + dr, u_c + dc
			if not _in_bounds(vr, vc, grid):
				continue
			cell_v = str(grid[vr][vc])
			if not _is_drivable(cell_v):
				continue
			# If stepping into a teleport, land on its partner immediately
			if cell_v.startswith('T') and (vr, vc) in partner:
				v = partner[(vr, vc)]
			else:
				v = (vr, vc)
			if dist[u] + 1 < dist[v]:
				dist[v] = dist[u] + 1
				parent[v] = (u, mv)
				q.append(v)

	return dist, parent


def _reconstruct_moves(parent: Dict[Position, Tuple[Position, str]], src: Position, dst: Position) -> List[str]:
	moves_rev: List[str] = []
	cur = dst
	while cur != src:
		if cur not in parent:
			return []
		prev, mv = parent[cur]
		moves_rev.append(mv)
		cur = prev
	moves_rev.reverse()
	return moves_rev


def _pairwise_shortest_paths(grid: Grid, points: List[Position], partner: Dict[Position, Position]) -> Tuple[List[List[int]], Dict[Tuple[int, int], List[str]]]:
	n = len(points)
	dist_matrix: List[List[int]] = [[10 ** 9] * n for _ in range(n)]
	move_paths: Dict[Tuple[int, int], List[str]] = {}
	for i, src in enumerate(points):
		dist, parent = _zero_one_bfs(grid, src, partner)
		for j, dst in enumerate(points):
			if i == j:
				dist_matrix[i][j] = 0
				move_paths[(i, j)] = []
				continue
			if dst in dist and dist[dst] < 10 ** 9:
				moves = _reconstruct_moves(parent, src, dst)
				dist_matrix[i][j] = dist[dst]
				move_paths[(i, j)] = moves
			else:
				dist_matrix[i][j] = 10 ** 9
				move_paths[(i, j)] = []
	return dist_matrix, move_paths


def _held_karp_tsp(dist: List[List[int]]) -> Tuple[int, List[int]]:
	# Start at index 0 (the 'S'), visit all others, do not return.
	n = len(dist)
	ALL = 1 << n
	INF = 10 ** 9
	# dp[mask][j] = (cost, prev)
	dp: List[Dict[int, Tuple[int, int]]] = [
		{ } for _ in range(ALL)
	]
	start_mask = 1 << 0
	dp[start_mask][0] = (0, -1)

	for mask in range(ALL):
		if not (mask & start_mask):
			continue
		for j, (cost_j, _) in list(dp[mask].items()):
			for k in range(n):
				if mask & (1 << k):
					continue
				new_mask = mask | (1 << k)
				cand = cost_j + dist[j][k]
				existing = dp[new_mask].get(k)
				if existing is None or cand < existing[0] or (cand == existing[0] and j < existing[1]):
					dp[new_mask][k] = (cand, j)

	full_mask = (1 << n) - 1
	best_cost = INF
	end_idx = n  # prefer smaller index on tie
	for j, (cost_j, _) in dp[full_mask].items():
		if j == 0:
			continue
		if cost_j < best_cost or (cost_j == best_cost and j < end_idx):
			best_cost = cost_j
			end_idx = j

	if end_idx == n:
		raise ValueError("No feasible tour that visits all flags")

	# Reconstruct terminal order
	order: List[int] = []
	mask = full_mask
	j = end_idx
	while j != -1:
		order.append(j)
		cost_j, prev_j = dp[mask][j]
		mask ^= (1 << j)
		j = prev_j
	order.reverse()
	return best_cost, order


def solve_grid_to_moves(grid: Grid) -> List[str]:
	start, flags, teleports = _find_key_points(grid)
	partner = _teleport_partner_map(teleports)
	points: List[Position] = [start] + flags
	# Precompute pairwise shortest paths with teleport as 0-cost edges
	dist, move_paths = _pairwise_shortest_paths(grid, points, partner)
	# Ensure all flags are reachable from start at least
	for i in range(1, len(points)):
		if dist[0][i] >= 10 ** 9:
			raise ValueError("Some flags are unreachable from start")
	# Solve TSP (path variant, no return)
	_, order = _held_karp_tsp(dist)
	# Concatenate moves, skipping teleport labels
	moves: List[str] = []
	for a, b in zip(order, order[1:]):
		segment = move_paths[(a, b)]
		for mv in segment:
			if mv == 'T':
				continue
			if mv == 'U':
				moves.append('up')
			elif mv == 'D':
				moves.append('down')
			elif mv == 'L':
				moves.append('left')
			elif mv == 'R':
				moves.append('right')
	return moves


