import * as fs from 'fs';
import * as path from 'path';
import { HttpError } from '../../utils/http-error';

class EntityService {

    constructor() {
        this.watchEntityFolder((eventType, filename) => {
            console.log(`File ${filename} was ${eventType}`);
        });
        console.log('EntityService Initialized');
    }

    watchEntityFolder(callback: (eventType: string, filename: string) => void) {
        const dirPath = path.join(process.cwd(), 'json', 'entities');
        const entitiesFile = '_entities.json';
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }
        fs.watch(dirPath, (eventType, filename) => {
            if (
                filename &&
                filename.endsWith('.json') &&
                filename !== entitiesFile
            ) {
                callback(eventType, filename);

                const changedFilePath = path.join(dirPath, filename);
                const entitiesPath = path.join(dirPath, entitiesFile);

                // Xử lý file bị xóa
                if (eventType === 'rename' && !fs.existsSync(changedFilePath)) {
                    if (fs.existsSync(entitiesPath)) {
                        try {
                            // Đọc _entities.json
                            const entitiesData = fs.readFileSync(entitiesPath, 'utf8');
                            let entities = JSON.parse(entitiesData);

                            // Lấy collection_name từ tên file (bỏ .json)
                            const collectionName = filename.replace('.json', '');

                            // Xóa entry theo collection_name
                            entities.documents = entities.documents.filter(
                                (doc: any) => doc.collection_name !== collectionName
                            );

                            // Ghi lại _entities.json
                            fs.writeFileSync(entitiesPath, JSON.stringify(entities, null, 2));
                            console.log(`Đã xóa entry với collection_name ${collectionName} từ _entities.json`);
                        } catch (err) {
                            console.error(`Lỗi khi xử lý xóa entry từ file ${filename}:`, err);
                        }
                    }
                    return; // Dừng xử lý vì file đã bị xóa
                }

                // Xử lý file thêm mới hoặc thay đổi (code hiện tại)
                if (fs.existsSync(changedFilePath)) {
                    try {
                        // ...code hiện tại của bạn...
                    } catch (err) {
                        console.error(`Lỗi khi xử lý file ${filename}:`, err);
                    }
                }
            }
        });
    }

    async getListEntity() {
        let dirPath = path.join(process.cwd(), 'json', 'entities');
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }
        let files = fs.readdirSync(dirPath);
        let listEntity = [];
        for (const file of files) {
            if (file.endsWith('.json')) {
                let filePath = path.join(dirPath, file);
                let data = fs.readFileSync(filePath, 'utf8');
                let jsonData = JSON.parse(data);
                listEntity.push(jsonData);
            }
        }
        return listEntity;
    }

    async getEntityByCollectionName(collectionName: string) {
        let dirPath = path.join(process.cwd(), 'json', 'entities');
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }
        let files = fs.readdirSync(dirPath);
        for (const file of files) {
            if (file.endsWith('.json')) {
                let filePath = path.join(dirPath, file);
                let data = fs.readFileSync(filePath, 'utf8');
                let jsonData = JSON.parse(data);
                if (jsonData.collection_name === collectionName) {
                    return jsonData;
                }
            }
        }
        throw new Error(`Entity with collection name ${collectionName} not found`);
    }

    async findOne(collectionName: string) {
        let dirPath = path.join(process.cwd(), 'json', 'entities');
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }
        let files = fs.readdirSync(dirPath);
        for (const file of files) {
            if (file.endsWith('.json')) {
                let filePath = path.join(dirPath, file);
                let data = fs.readFileSync(filePath, 'utf8');
                let jsonData = JSON.parse(data);
                if (jsonData.collection_name === collectionName) {
                    return jsonData;
                }
            }
        }
        return null; 
    }

    async createEntityFile(entity: any) {
        if (!entity.mongodb_collection_name) {
            throw new HttpError(`Entity must have mongodb_collection_name`);
        }
        let _entity = await this.findOne(entity.mongodb_collection_name);
        if (_entity) {
            throw new Error(`Entity with collection name ${entity.mongodb_collection_name} already exists`);
        }
        let dirPath = path.join(process.cwd(), 'json', 'entities');
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }
        let fileName = `${entity.mongodb_collection_name}.json`;
        let filePath = path.join(dirPath, fileName);
        fs.writeFileSync(filePath, JSON.stringify(entity, null, 2));
        return entity;
    }

    async updateEntityFile(collectionName: string, entity: any) {
        if (!entity.collection_name || entity.collection_name !== collectionName) {
            throw new HttpError(`Entity must have collection_name`);
        }
        let dirPath = path.join(process.cwd(), 'json', 'entities');
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }
        let fileName = `${collectionName}.json`;
        let filePath = path.join(dirPath, fileName);
        if (fs.existsSync(filePath)) {
            fs.writeFileSync(filePath, JSON.stringify(entity, null, 2));
        }
        else {
            throw new Error(`File ${fileName} does not exist`);
        }
    }

    async deleteEntityFile(collectionName: string) {
        let dirPath = path.join(process.cwd(), 'json', 'entities');
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }
        let fileName = `${collectionName}.json`;
        let filePath = path.join(dirPath, fileName);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
        else {
            throw new Error(`File ${fileName} does not exist`);
        }
    }

}

export const entityService = new EntityService();