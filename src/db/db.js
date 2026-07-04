import mongoose from "mongoose";
import { DB_NAME } from "../constants.js";

const connectDB = async () => {
    try {
        const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
        let connectionString = uri;

        if (connectionString) {
            if (!connectionString.includes(DB_NAME)) {
                const qIndex = connectionString.indexOf('?');
                if (qIndex !== -1) {
                    const beforeQ = connectionString.substring(0, qIndex);
                    const afterQ = connectionString.substring(qIndex);
                    const slash = beforeQ.endsWith('/') ? '' : '/';
                    connectionString = `${beforeQ}${slash}${DB_NAME}${afterQ}`;
                } else {
                    const slash = connectionString.endsWith('/') ? '' : '/';
                    connectionString = `${connectionString}${slash}${DB_NAME}`;
                }
            }
        } else {
            connectionString = `mongodb://127.0.0.1:27017/${DB_NAME}`;
        }

        const connectionInstance = await mongoose.connect(connectionString);
        console.log(`\n MongoDB connected!! DB Host: ${connectionInstance.connection.host}`);
    } catch (error) {
        console.log("Error", error);
        process.exit(1);
    }
}

export default connectDB;