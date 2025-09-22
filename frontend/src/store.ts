import { create } from 'zustand'
import type { Grid, Track } from './api'

export interface GameState {
	tracks: Track[]
	selectedTrackId: string | null
	playerPos: { r: number; c: number } | null
	flagsRemaining: number
	teleports: Record<string, [number, number][]>
	collectedFlags: { r: number; c: number }[]
	setTracks: (tracks: Track[]) => void
	selectTrack: (id: string) => void
	resetFromGrid: (grid: Grid) => void
	move: (dr: number, dc: number, grid: Grid) => void
}

function findStart(grid: Grid): { r: number; c: number } {
	for (let r = 0; r < grid.length; r += 1) {
		for (let c = 0; c < grid[r].length; c += 1) {
			if (grid[r][c] === 'S') return { r, c }
		}
	}
	throw new Error('No start S found')
}

function countFlags(grid: Grid): number {
	let count = 0
	for (let r = 0; r < grid.length; r += 1) {
		for (let c = 0; c < grid[r].length; c += 1) {
			if (grid[r][c] === 'F') count += 1
		}
	}
	return count
}

function buildTeleports(grid: Grid): Record<string, [number, number][]> {
	const tp: Record<string, [number, number][]> = {}
	for (let r = 0; r < grid.length; r += 1) {
		for (let c = 0; c < grid[r].length; c += 1) {
			const cell = grid[r][c]
			if (cell.startsWith('T')) {
				if (!tp[cell]) tp[cell] = []
				tp[cell].push([r, c])
			}
		}
	}
	return tp
}

export const useGameStore = create<GameState>((set, get) => ({
	tracks: [],
	selectedTrackId: null,
	playerPos: null,
	flagsRemaining: 0,
	teleports: {},
	collectedFlags: [],
	setTracks: (tracks) => set({ tracks }),
	selectTrack: (id) => set({ selectedTrackId: id }),
	resetFromGrid: (grid) => set({
		playerPos: findStart(grid),
		flagsRemaining: countFlags(grid),
		teleports: buildTeleports(grid),
		collectedFlags: [],
	}),
	move: (dr, dc, grid) => {
		const state = get()
		if (!state.playerPos) return
		const nr = state.playerPos.r + dr
		const nc = state.playerPos.c + dc
		if (nr < 0 || nc < 0 || nr >= grid.length || nc >= grid[0].length) return
		const dest = grid[nr][nc]
		if (dest === '0') return

		let nextR = nr
		let nextC = nc
		let flagsLeft = state.flagsRemaining
		const teleports = { ...state.teleports }
		let collected = state.collectedFlags

		if (dest === 'F') {
			flagsLeft = Math.max(0, flagsLeft - 1)
			grid[nr][nc] = '1'
			collected = [...collected, { r: nr, c: nc }]
		}

		if (dest.startsWith('T')) {
			const points = teleports[dest] || []
			if (points.length === 2) {
				const [a, b] = points
				const atA = a[0] === nr && a[1] === nc
				;[nextR, nextC] = atA ? b : a
			}
		}

		set({ playerPos: { r: nextR, c: nextC }, flagsRemaining: flagsLeft, collectedFlags: collected })
	},
}))
