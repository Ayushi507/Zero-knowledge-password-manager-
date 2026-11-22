import { Request, Response, NextFunction } from 'express';
import VaultEntry from '../models/VaultEntry.js';
import { AppError } from '../utils/AppError.js';

export const getAllEntries = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const entries = await VaultEntry.find({ userId: req.user._id }).sort('-createdAt');
        
        res.status(200).json({
            success: true,
            results: entries.length,
            data: {
                entries
            }
        });
    } catch (err) {
        next(err);
    }
};

export const createEntry = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { encryptedData, iv, salt, version, favorite } = req.body;
        
        const newEntry = await VaultEntry.create({
            userId: req.user._id,
            encryptedData,
            iv,
            salt,
            version,
            favorite
        });

        res.status(201).json({
            success: true,
            data: {
                entry: newEntry
            }
        });
    } catch (err) {
        next(err);
    }
};

export const deleteEntry = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const entry = await VaultEntry.findOneAndDelete({
            _id: req.params.id,
            userId: req.user._id
        });

        if (!entry) {
            return next(new AppError('No entry found with that ID', 404));
        }

        res.status(204).json({
            success: true,
            data: null
        });
    } catch (err) {
        next(err);
    }
};

export const updateEntry = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { version, encryptedData, iv, salt, favorite } = req.body;

        // Atomic Optimistic Concurrency Control
        const query: any = { _id: req.params.id, userId: req.user._id };
        if (typeof version === 'number') {
            query.version = version;
        }

        const updatePayload: any = {
            ...(encryptedData !== undefined && { encryptedData }),
            ...(iv !== undefined && { iv }),
            ...(salt !== undefined && { salt }),
            ...(favorite !== undefined && { favorite }),
            $inc: { version: 1 }
        };

        const entry = await VaultEntry.findOneAndUpdate(
            query,
            updatePayload,
            { new: true, runValidators: true }
        );

        if (!entry) {
            // Check if entry exists with an advanced version (optimistic concurrency conflict)
            const exists = await VaultEntry.findOne({ _id: req.params.id, userId: req.user._id });
            if (exists) {
                return next(new AppError('Concurrent modification conflict: Vault entry version mismatch', 409));
            }
            return next(new AppError('No entry found with that ID', 404));
        }

        res.status(200).json({
            success: true,
            data: {
                entry
            }
        });
    } catch (err) {
        next(err);
    }
};

