import express, { Request, Response } from "express";
import cors from "cors";
import { createConnection, getMongoManager, getMongoRepository} from "typeorm";
import * as amqp from "amqplib/callback_api";
import { Product } from "./entity/product";

import "reflect-metadata";

createConnection().then((db) => {
  // const productRepository = db.getMongoRepository(Product);
  const manager = getMongoManager();
  const productRepository = getMongoRepository(Product);
  amqp.connect("amqp://localhost", (error0, connection) => {
    if (error0) {
      throw error0;
    }

    connection.createChannel((error1, channel) => {
      if (error1) {
        throw error1;
      }

      channel.assertQueue("product_created", { durable: false });
      channel.assertQueue("product_updated", { durable: false });
      channel.assertQueue("product_deleted", { durable: false });

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

      channel.consume(
        "product_created",
        async (msg) => {
          let msg_product = JSON.stringify(msg?.content.toString());
          const eventProduct: Product = JSON.parse(JSON.parse(msg_product));
          const product = new Product();
          product.admin_id = parseInt(eventProduct.id);
          product.title = eventProduct.title;
          product.image = eventProduct.image;
          product.likes = eventProduct.likes;
          await productRepository.save(product);
          console.log("product created");
        },
        { noAck: true }
      );

      channel.consume(
        "product_updated",
        async (msg) => {
          let msg_product = JSON.stringify(msg?.content.toString());
          const eventProduct: Product = JSON.parse(JSON.parse(msg_product));

          console.log(eventProduct.id);
          // let product = await productRepository.findOne({ admin_id: eventProduct.id });
          const product = await productRepository.findOne({admin_id: parseInt(eventProduct.id)})

          // const product = await manager.findOne(Product, { admin_id: eventProduct.id});

          // const product = await productRepository.findOne({admin_id: parseInt(eventProduct.id)});

          console.log(product);

          // productRepository.merge(product, {
          //     title: eventProduct.title,
          //     image: eventProduct.image,
          //     likes: eventProduct.likes
          // })
          // await productRepository.save(product);
          // console.log('product updated');
        },
        { noAck: true }
      );

      channel.consume("product_deleted", async (msg) => {
        let msg_product = JSON.stringify(msg?.content.toString());
        const admin_id = JSON.parse(JSON.parse(msg_product));
        await productRepository.deleteOne({ admin_id });
        console.log("product deleted");
      });

      app.listen(8001, () => {
        console.log("Start On Port 8001");
      });

      process.on("beforeExit", () => {
        console.log("closing");
        connection.close();
      });
    });
  });
});
