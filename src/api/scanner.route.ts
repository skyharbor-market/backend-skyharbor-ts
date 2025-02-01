import express, { Request, Response } from 'express'
import cors from 'cors'

const router = express.Router()

const origins = ['http://localhost:8080', 'http://127.0.0.1:8080']
const options: cors.CorsOptions = {
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
  ],
  methods: 'PUT',
  origin: origins,
  preflightContinue: false,
}

router.put('/pause', cors(options), async (req: Request, res: Response) => {
  globalThis.ssWorker.pauseScanning(true)
  res.status(200).send({ result: "success" })
})

router.put('/unpause', cors(options), async (req: Request, res: Response) => {
  globalThis.ssWorker.pauseScanning(false)
  res.status(200).send({ result: "success" })
})

export default router
