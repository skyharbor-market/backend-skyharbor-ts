import express, { NextFunction, Request, Response } from "express"

const router = express.Router();

/* GET routes details */
router.get('/', function (req: Request, res: Response, next: NextFunction) {
  res.render('routes', { title: 'routes info!' });
});

export default router
