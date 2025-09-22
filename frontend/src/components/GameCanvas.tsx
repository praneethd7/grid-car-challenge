import { useEffect, useMemo, useRef, useState } from 'react'
import type { Grid } from '../api'
import { useGameStore } from '../store'

interface Props {
	grid: Grid
	player: { r: number; c: number } | null
	cellSize?: number
}

const CAR_SPRITE = '/car.svg'
const FLAG_SPRITE = '/flag.svg'
const STAR_SPRITE = '/star.svg'

export default function GameCanvas({ grid, player, cellSize = 40 }: Props) {
	const canvasRef = useRef<HTMLCanvasElement | null>(null)
	const carImgRef = useRef<HTMLImageElement | null>(null)
	const flagImgRef = useRef<HTMLImageElement | null>(null)
	const starImgRef = useRef<HTMLImageElement | null>(null)
	const [assetsVersion, setAssetsVersion] = useState(0)
	const collectedFlags = useGameStore(s => s.collectedFlags)
	const trailRef = useRef<{ r: number; c: number }[]>([])
	const prevPlayerRef = useRef<{ r: number; c: number } | null>(null)
	const dims = useMemo(() => ({
		w: grid[0]?.length ? grid[0].length * cellSize : 0,
		h: grid.length * cellSize,
	}), [grid, cellSize])

	useEffect(() => {
		const carImg = new Image()
		carImg.crossOrigin = 'anonymous'
		const flagImg = new Image()
		flagImg.crossOrigin = 'anonymous'
		const starImg = new Image()
		starImg.crossOrigin = 'anonymous'
		const markChange = () => setAssetsVersion(v => v + 1)
		carImg.onload = markChange
		flagImg.onload = markChange
		starImg.onload = markChange
		carImg.onerror = markChange
		flagImg.onerror = markChange
		starImg.onerror = markChange
		carImg.src = CAR_SPRITE
		flagImg.src = FLAG_SPRITE
		starImg.src = STAR_SPRITE
		carImgRef.current = carImg
		flagImgRef.current = flagImg
		starImgRef.current = starImg
		if (carImg.complete) markChange()
		if (flagImg.complete) markChange()
		if (starImg.complete) markChange()
	}, [])

	useEffect(() => {
		trailRef.current = []
		prevPlayerRef.current = null
	}, [grid])

	useEffect(() => {
		if (!player) return
		const prev = prevPlayerRef.current
		if (!prev || prev.r !== player.r || prev.c !== player.c) {
			trailRef.current.push({ r: player.r, c: player.c })
			prevPlayerRef.current = { r: player.r, c: player.c }
		}
	}, [player])

	useEffect(() => {
		const canvas = canvasRef.current
		if (!canvas) return
		const ctx = canvas.getContext('2d')
		if (!ctx) return

		try {
			ctx.clearRect(0, 0, dims.w, dims.h)

			const collectedSet = new Set(collectedFlags.map(p => `${p.r},${p.c}`))

			for (let r = 0; r < grid.length; r += 1) {
				for (let c = 0; c < grid[r].length; c += 1) {
					const x = c * cellSize
					const y = r * cellSize
					const cell = grid[r][c]
					if (cell === '0') {
						ctx.fillStyle = '#3a5f0b'
					} else if (cell === '1' || cell === 'S') {
						ctx.fillStyle = '#aaaaaa'
					} else if (cell === 'F') {
						ctx.fillStyle = '#aaaaaa'
					} else if (typeof cell === 'string' && cell.startsWith('T')) {
						ctx.fillStyle = '#8888ff'
					} else {
						ctx.fillStyle = '#333333'
					}
					ctx.fillRect(x, y, cellSize, cellSize)

					if (cell === 'F') {
						const img = flagImgRef.current
						if (img && img.complete && img.naturalWidth > 0) {
							ctx.drawImage(img, x + cellSize * 0.1, y + cellSize * 0.1, cellSize * 0.8, cellSize * 0.8)
						}
					}

					// draw star on collected flag tiles
					if (collectedSet.has(`${r},${c}`)) {
						const star = starImgRef.current
						if (star && star.complete && star.naturalWidth > 0) {
							ctx.drawImage(star, x + cellSize * 0.1, y + cellSize * 0.1, cellSize * 0.8, cellSize * 0.8)
						}
					}

					if (typeof cell === 'string' && cell.startsWith('T')) {
						ctx.fillStyle = '#000066'
						ctx.font = `${Math.floor(cellSize * 0.4)}px sans-serif`
						ctx.textAlign = 'center'
						ctx.textBaseline = 'middle'
						ctx.fillText(cell, x + cellSize / 2, y + cellSize / 2)
					}
				}
			}

			// thin grid lines (very fine)
			{
				const rows = grid.length
				const cols = grid[0]?.length ?? 0
				ctx.strokeStyle = 'rgba(0,0,0,0.25)'
				ctx.lineWidth = 0.5
				ctx.beginPath()
				for (let r = 0; r <= rows; r += 1) {
					const y = r * cellSize + 0.5
					ctx.moveTo(0.5, y)
					ctx.lineTo(dims.w - 0.5, y)
				}
				for (let c = 0; c <= cols; c += 1) {
					const x = c * cellSize + 0.5
					ctx.moveTo(x, 0.5)
					ctx.lineTo(x, dims.h - 0.5)
				}
				ctx.stroke()
			}

			const trail = trailRef.current
			if (trail.length > 1) {
				ctx.strokeStyle = '#000000'
				ctx.lineWidth = Math.max(2, cellSize * 0.08)
				ctx.lineCap = 'round'
				ctx.lineJoin = 'round'
				ctx.beginPath()
				for (let i = 0; i < trail.length; i += 1) {
					const p = trail[i]
					const cx = p.c * cellSize + cellSize / 2
					const cy = p.r * cellSize + cellSize / 2
					if (i === 0) ctx.moveTo(cx, cy)
					else ctx.lineTo(cx, cy)
				}
				ctx.stroke()
			}

			if (player) {
				const x = player.c * cellSize
				const y = player.r * cellSize
				const img = carImgRef.current
				if (img && img.complete && img.naturalWidth > 0) {
					ctx.drawImage(img, x + cellSize * 0.1, y + cellSize * 0.1, cellSize * 0.8, cellSize * 0.8)
				}
			}
		} catch (err) {
			console.error('Canvas draw error:', err)
		}
	}, [grid, player, cellSize, dims, assetsVersion, collectedFlags])

	return <canvas ref={canvasRef} width={dims.w} height={dims.h} />
}
