import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import { fetchTracks, solveGrid, type Grid, type Track } from './api'
import { useGameStore } from './store'
import GameCanvas from './components/GameCanvas'

function useSelectedTrackGrid(tracks: Track[], selectedId: string | null, rev: number): Grid | null {
	return useMemo(() => {
		const t = tracks.find((x) => x.id === selectedId)
		return t ? JSON.parse(JSON.stringify(t.grid)) as Grid : null
	}, [tracks, selectedId, rev])
}

function App() {
	const { tracks, selectedTrackId, setTracks, selectTrack, playerPos, resetFromGrid, move, flagsRemaining } = useGameStore()
	const [loading, setLoading] = useState(true)
	const [isRunning, setIsRunning] = useState(false)
	const [rev, setRev] = useState(0)
	const runSeqRef = useRef(0)
	const grid = useSelectedTrackGrid(tracks, selectedTrackId, rev)

	useEffect(() => {
		fetchTracks().then((t) => {
			setTracks(t)
			if (t.length > 0) selectTrack(t[0].id)
		}).finally(() => setLoading(false))
	}, [setTracks, selectTrack])

	useEffect(() => {
		if (grid) {
			resetFromGrid(grid)
		}
	}, [selectedTrackId, grid, resetFromGrid])

	useEffect(() => {
		function onKey(e: KeyboardEvent) {
			if (!grid) return
			if (e.key === 'ArrowUp' || e.key === 'w') move(-1, 0, grid)
			else if (e.key === 'ArrowDown' || e.key === 's') move(1, 0, grid)
			else if (e.key === 'ArrowLeft' || e.key === 'a') move(0, -1, grid)
			else if (e.key === 'ArrowRight' || e.key === 'd') move(0, 1, grid)
		}
		document.addEventListener('keydown', onKey)
		return () => document.removeEventListener('keydown', onKey)
	}, [grid, move])

	async function onStart() {
		if (!grid || isRunning) return
		setIsRunning(true)
		runSeqRef.current += 1
		const seq = runSeqRef.current
		try {
			// Move 'S' to the current player position for backend solve
			let reqGrid: Grid = JSON.parse(JSON.stringify(grid))
			if (playerPos) {
				for (let r = 0; r < reqGrid.length; r += 1) {
					for (let c = 0; c < reqGrid[r].length; c += 1) {
						if (reqGrid[r][c] === 'S') reqGrid[r][c] = '1'
					}
				}
				reqGrid[playerPos.r][playerPos.c] = 'S'
			}
			const moves = await solveGrid(reqGrid)
			for (const m of moves) {
				if (!grid) break
				if (runSeqRef.current !== seq) break
				if (m === 'up') move(-1, 0, grid)
				else if (m === 'down') move(1, 0, grid)
				else if (m === 'left') move(0, -1, grid)
				else if (m === 'right') move(0, 1, grid)
				await new Promise((r) => setTimeout(r, 150))
			}
		} catch (e) {
			console.error('Start animation error:', e)
		} finally {
			setIsRunning(false)
		}
	}

	function onReset() {
		runSeqRef.current += 1
		setIsRunning(false)
		setRev((x) => x + 1)
	}

	if (loading) return <div>Loading tracks...</div>

	return (
		<div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
			<h2>Car Track Game</h2>
			<div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
				<label>
					Track:
					<select
						value={selectedTrackId ?? ''}
						onChange={(e) => {
							selectTrack(e.target.value)
							setRev((x) => x + 1)
						}}
						style={{ marginLeft: 8 }}
					>
						{tracks.map((t) => (
							<option key={t.id} value={t.id}>{t.name}</option>
						))}
					</select>
				</label>
				<button disabled={isRunning || !grid} onClick={onStart}>Start</button>
				<button onClick={onReset}>Reset</button>
				<div>Flags remaining: <strong>{flagsRemaining}</strong></div>
			</div>
			<div>
				{grid && <GameCanvas grid={grid} player={playerPos} cellSize={48} />}
			</div>
		</div>
	)
}

export default App
