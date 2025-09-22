import axios from 'axios'

export type Tile = string
export type Grid = Tile[][]

export interface Track {
	id: string
	name: string
	grid: Grid
}

export interface TrackListResponse {
	tracks: Track[]
}

export interface ValidateResponse {
	valid: boolean
	message: string
}

export interface SolveResponse {
	moves: string[]
}

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'

export async function fetchTracks(): Promise<Track[]> {
	const { data } = await axios.get<TrackListResponse>(`${API_BASE}/api/tracks`)
	return data.tracks
}

export async function validateGrid(grid: Grid): Promise<ValidateResponse> {
	const { data } = await axios.post<ValidateResponse>(`${API_BASE}/api/validate`, { grid })
	return data
}

export async function solveGrid(grid: Grid): Promise<string[]> {
	const { data } = await axios.post<SolveResponse>(`${API_BASE}/api/solve`, { grid })
	return data.moves
}
