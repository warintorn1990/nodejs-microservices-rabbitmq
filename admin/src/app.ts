import express, { Request, Response } from "express";
import cors from "cors";
import { createConnection } from "typeorm";
import { Product } from "./entity/product";
import * as amqp from "amqplib/callback_api";

createConnection().then((db) => {
  const productRepository = db.getRepository(Product);

  amqp.connect("amqp://localhost", (error0, connection) => {
    if (error0) {
      throw error0;
    }

    connection.createChannel((error1, channel) => {
      const app = express();
      app.use(express.json());
      app.use(express.urlencoded({ extended: false }));

      app.use(
        cors({
          origin: [
            "http://localhost:3000",
            "http://localhost:8080",
            "http://localhost:4200",
          ],
        })
      );

      app.get("/api/products", async (req: Request, res: Response) => {
        const products = await productRepository.find();
        res.json(products);
      });

      app.post("/api/products", async (req: Request, res: Response) => {
        const product = await productRepository.create(req.body);
        const result = await productRepository.save(product);
        channel.sendToQueue(
          "product_created",
          Buffer.from(JSON.stringify(result), 'utf-8')
        );
        return res.send(result);
      });

      app.get("/api/products/:id", async (req: Request, res: Response) => {
        const product = await productRepository.findOne(req.params.id);
        return res.json(product);
      });

      app.put("/api/products/:id", async (req: Request, res: Response) => {
        const product = await productRepository.findOne(req.params.id);
        productRepository.merge(product, req.body);
        const result = await productRepository.save(product);
        channel.sendToQueue('product_updated', Buffer.from(JSON.stringify(result)));
        return res.send(result);
      });

      app.delete("/api/products/:id", async (req: Request, res: Response) => {
        const product = await productRepository.delete(req.params.id);
        channel.sendToQueue('product_deleted', Buffer.from(req.params.id));
        return res.json({
          message: "Success",
        });
      });

      app.post(
        "/api/products/:id/like",
        async (req: Request, res: Response) => {
          const product = await productRepository.findOne(req.params.id);
          product.likes++;
          const result = await productRepository.save(product);
          return res.send(result);
        }
      );

      app.listen(8000, () => {
        console.log("Start On Port 8000");
      });

      process.on("beforeExit", () => {
        console.log("closing");
        connection.close();
      });
    });
  });
});
