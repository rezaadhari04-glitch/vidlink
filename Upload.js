const Busboy = require("busboy");
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

exports.handler = async (event) => {

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({
        error: "Method tidak diizinkan"
      })
    };
  }

  try {

    const contentType =
      event.headers["content-type"] ||
      event.headers["Content-Type"];

    const busboy = Busboy({
      headers: {
        "content-type": contentType
      }
    });

    let fileBuffer = null;
    let fileMime = "";
    let fileName = "";

    await new Promise((resolve, reject) => {

      busboy.on(
        "file",
        (fieldname, file, info) => {

          fileName = info.filename;
          fileMime = info.mimeType;

          const chunks = [];

          file.on("data", chunk => {
            chunks.push(chunk);
          });

          file.on("end", () => {
            fileBuffer =
              Buffer.concat(chunks);
          });

        }
      );

      busboy.on("finish", resolve);

      busboy.on("error", reject);

      busboy.end(
        Buffer.from(
          event.body,
          event.isBase64Encoded
            ? "base64"
            : "binary"
        )
      );

    });

    if (!fileBuffer) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: "Video tidak ditemukan"
        })
      };
    }

    const extension =
      fileName.includes(".")
        ? fileName.split(".").pop()
        : "mp4";

    const randomName =
      Date.now() +
      "-" +
      Math.random()
        .toString(36)
        .substring(2, 10) +
      "." +
      extension;

    const filePath =
      "videos/" + randomName;

    const { error } =
      await supabase.storage
        .from("videos")
        .upload(
          filePath,
          fileBuffer,
          {
            contentType: fileMime,
            upsert: false
          }
        );

    if (error) {
      throw error;
    }

    const { data } =
      supabase.storage
        .from("videos")
        .getPublicUrl(filePath);

    return {
      statusCode: 200,
      headers: {
        "Content-Type":
          "application/json"
      },
      body: JSON.stringify({
        success: true,
        url: data.publicUrl
      })
    };

  } catch (error) {

    return {
      statusCode: 500,
      body: JSON.stringify({
        error: error.message
      })
    };

  }

};
