import express, { Request, Response } from "express"
import cors from "cors"
import { Address, verify_signature } from 'ergo-lib-wasm-nodejs'
import { Jwt } from 'jsonwebtoken'

const router = express.Router();

const origins = ['https://skyharbor.io', 'https://www.skyharbor.io', 'http://localhost:3000', 'http://127.0.0.1:3000']
const options: cors.CorsOptions = {
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
  ],
  methods: 'OPTIONS,POST',
  origin: origins,
  preflightContinue: false,
};
router.options('*', cors(options), async (req: Request, res: Response) => {
  res.status(200);
});

router.post('/verifySig', cors(options), async (req: Request, res: Response) => {

  console.log(req.body)
  res.status(200)
  res.send()
  // res.status(500);
  // res.send({ "message": "verify signature failed" });
})

export default router