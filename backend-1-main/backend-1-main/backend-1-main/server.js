const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

require("dotenv").config();

const pool = require("./db");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
    res.json({
        success: true,
        message: "Media Gallery API is running"
    });
});

function verifyToken(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).json({
            success: false,
            message: "Token required"
        });
    }

    if (!authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
            success: false,
            message: "Invalid authorization format"
        });
    }

    const token = authHeader.split(" ")[1];

    try {
        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        req.user = decoded;
        next();

    } catch (error) {
        console.error("JWT ERROR:", error.message);

        return res.status(401).json({
            success: false,
            message: "Invalid or expired token"
        });
    }
}

function verifyAdmin(req, res, next) {
    if (!req.user) {
        return res.status(401).json({
            success: false,
            message: "Authentication required"
        });
    }

    if (req.user.role !== "admin") {
        return res.status(403).json({
            success: false,
            message: "Admin access required"
        });
    }

    next();
}

app.post(
    "/api/auth/register",
    async (req, res) => {
        try {
            const {
                username,
                password
            } = req.body;

            if (!username || !password) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Username and password are required"
                });
            }

            const cleanUsername =
                String(username).trim();

            if (cleanUsername.length < 3) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Username must be at least 3 characters"
                });
            }

            if (password.length < 6) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Password must be at least 6 characters"
                });
            }

            const [usernameRows] =
                await pool.query(
                    `
                    SELECT id
                    FROM users
                    WHERE username = ?
                    LIMIT 1
                    `,
                    [cleanUsername]
                );

            if (usernameRows.length > 0) {
                return res.status(409).json({
                    success: false,
                    message:
                        "Username already exists"
                });
            }

            const hashedPassword =
                await bcrypt.hash(
                    password,
                    10
                );

            const [result] =
                await pool.query(
                    `
                    INSERT INTO users
                    (
                        username,
                        password,
                        role
                    )
                    VALUES (?, ?, ?)
                    `,
                    [
                        cleanUsername,
                        hashedPassword,
                        "user"
                    ]
                );

            res.status(201).json({
                success: true,
                message:
                    "Registration successful",
                user: {
                    id: result.insertId,
                    username: cleanUsername,
                    role: "user"
                }
            });

        } catch (error) {
            console.error(
                "REGISTER ERROR:",
                error
            );

            res.status(500).json({
                success: false,
                message:
                    "Registration failed"
            });
        }
    }
);

app.post(
    "/api/auth/login",
    async (req, res) => {
        try {
            const {
                username,
                password
            } = req.body;

            if (!username || !password) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Username and password are required"
                });
            }

            const cleanUsername =
                String(username).trim();

            const [rows] =
                await pool.query(
                    `
                    SELECT
                        id,
                        username,
                        password,
                        role
                    FROM users
                    WHERE username = ?
                    LIMIT 1
                    `,
                    [cleanUsername]
                );

            if (rows.length === 0) {
                return res.status(401).json({
                    success: false,
                    message:
                        "Invalid username or password"
                });
            }

            const user = rows[0];

            const passwordMatch =
                await bcrypt.compare(
                    password,
                    user.password
                );

            if (!passwordMatch) {
                return res.status(401).json({
                    success: false,
                    message:
                        "Invalid username or password"
                });
            }

            const token =
                jwt.sign(
                    {
                        id: user.id,
                        username: user.username,
                        role: user.role
                    },
                    process.env.JWT_SECRET,
                    {
                        expiresIn: "7d"
                    }
                );

            res.json({
                success: true,
                message:
                    "Login successful",
                token: token,
                user: {
                    id: user.id,
                    username: user.username,
                    role: user.role
                }
            });

        } catch (error) {
            console.error(
                "LOGIN ERROR:",
                error
            );

            res.status(500).json({
                success: false,
                message:
                    "Login failed"
            });
        }
    }
);

app.get(
    "/api/auth/me",
    verifyToken,
    async (req, res) => {
        try {
            const [rows] =
                await pool.query(
                    `
                    SELECT
                        id,
                        username,
                        role
                    FROM users
                    WHERE id = ?
                    LIMIT 1
                    `,
                    [req.user.id]
                );

            if (rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message:
                        "User not found"
                });
            }

            res.json({
                success: true,
                user: rows[0]
            });

        } catch (error) {
            console.error(
                "GET USER ERROR:",
                error
            );

            res.status(500).json({
                success: false,
                message:
                    "Failed to load user"
            });
        }
    }
);

app.get(
    "/api/media",
    async (req, res) => {
        try {
            const [rows] =
                await pool.query(
                    `
                    SELECT
                        media.*,
                        users.username,
                        users.role
                    FROM media
                    LEFT JOIN users
                        ON media.user_id = users.id
                    ORDER BY media.id DESC
                    `
                );

            res.json({
                success: true,
                media: rows
            });

        } catch (error) {
            console.error(
                "GET MEDIA ERROR:",
                error
            );

            res.status(500).json({
                success: false,
                message:
                    "Failed to load media"
            });
        }
    }
);

app.get(
    "/api/media/:id",
    async (req, res) => {
        try {
            const { id } = req.params;

            const [rows] =
                await pool.query(
                    `
                    SELECT
                        media.*,
                        users.username,
                        users.role
                    FROM media
                    LEFT JOIN users
                        ON media.user_id = users.id
                    WHERE media.id = ?
                    LIMIT 1
                    `,
                    [id]
                );

            if (rows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message:
                        "Media not found"
                });
            }

            res.json({
                success: true,
                media: rows[0]
            });

        } catch (error) {
            console.error(
                "GET SINGLE MEDIA ERROR:",
                error
            );

            res.status(500).json({
                success: false,
                message:
                    "Failed to load media"
            });
        }
    }
);

app.post(
    "/api/media",
    verifyToken,
    async (req, res) => {
        try {
            const {
                title,
                price,
                link,
                fbLink,
                type
            } = req.body;

            if (!title || !link) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Title and link are required"
                });
            }

            const finalPrice = price || 0;
            const finalType = type || "photo";
            const userId = req.user.id;

            const [result] =
                await pool.query(
                    `
                    INSERT INTO media
                    (
                        title,
                        price,
                        link,
                        fb_link,
                        type,
                        user_id
                    )
                    VALUES (?, ?, ?, ?, ?, ?)
                    `,
                    [
                        title,
                        finalPrice,
                        link,
                        fbLink || "",
                        finalType,
                        userId
                    ]
                );

            res.status(201).json({
                success: true,
                message:
                    "Media added successfully",
                media: {
                    id: result.insertId,
                    title: title,
                    price: finalPrice,
                    link: link,
                    fbLink: fbLink || "",
                    type: finalType,
                    user_id: userId,
                    username: req.user.username,
                    role: req.user.role
                }
            });

        } catch (error) {
            console.error(
                "ADD MEDIA ERROR:",
                error
            );

            res.status(500).json({
                success: false,
                message:
                    "Failed to add media"
            });
        }
    }
);

app.delete(
    "/api/media/:id",
    verifyToken,
    async (req, res) => {
        const connection =
            await pool.getConnection();

        try {
            const { id } = req.params;

            await connection.beginTransaction();

            let result;

            if (req.user.role === "admin") {
                [result] =
                    await connection.query(
                        `
                        DELETE FROM media
                        WHERE id = ?
                        `,
                        [id]
                    );
            } else {
                [result] =
                    await connection.query(
                        `
                        DELETE FROM media
                        WHERE id = ?
                        AND user_id = ?
                        `,
                        [
                            id,
                            req.user.id
                        ]
                    );
            }

            if (result.affectedRows === 0) {
                await connection.rollback();

                return res.status(403).json({
                    success: false,
                    message:
                        "You do not have permission to delete this media"
                });
            }

            await connection.query(
                `
                DELETE FROM gallery_photos
                WHERE media_id = ?
                `,
                [id]
            );

            await connection.commit();

            res.json({
                success: true,
                message:
                    "Media and gallery deleted successfully"
            });

        } catch (error) {
            await connection.rollback();

            console.error(
                "DELETE MEDIA ERROR:",
                error
            );

            res.status(500).json({
                success: false,
                message:
                    "Failed to delete media"
            });

        } finally {
            connection.release();
        }
    }
);

app.get(
    "/api/gallery/:mediaId",
    async (req, res) => {
        try {
            const { mediaId } = req.params;

            const [rows] =
                await pool.query(
                    `
                    SELECT
                        gallery_photos.*,
                        users.username,
                        users.role
                    FROM gallery_photos
                    LEFT JOIN users
                        ON gallery_photos.user_id = users.id
                    WHERE gallery_photos.media_id = ?
                    ORDER BY gallery_photos.id DESC
                    `,
                    [mediaId]
                );

            res.json({
                success: true,
                gallery: rows
            });

        } catch (error) {
            console.error(
                "GET GALLERY ERROR:",
                error
            );

            res.status(500).json({
                success: false,
                message:
                    "Failed to load gallery"
            });
        }
    }
);

app.post(
    "/api/gallery",
    verifyToken,
    async (req, res) => {
        try {
            const {
                mediaId,
                photo,
                description
            } = req.body;

            if (!mediaId) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Media ID is required"
                });
            }

            if (!photo && !description) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Photo or description is required"
                });
            }

            const [mediaRows] =
                await pool.query(
                    `
                    SELECT id
                    FROM media
                    WHERE id = ?
                    LIMIT 1
                    `,
                    [mediaId]
                );

            if (mediaRows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message:
                        "Media not found"
                });
            }

            const userId = req.user.id;

            const [result] =
                await pool.query(
                    `
                    INSERT INTO gallery_photos
                    (
                        media_id,
                        photo,
                        description,
                        user_id
                    )
                    VALUES (?, ?, ?, ?)
                    `,
                    [
                        mediaId,
                        photo || "",
                        description || "",
                        userId
                    ]
                );

            res.status(201).json({
                success: true,
                message:
                    "Gallery item added successfully",
                gallery: {
                    id: result.insertId,
                    media_id: mediaId,
                    photo: photo || "",
                    description: description || "",
                    user_id: userId,
                    username: req.user.username,
                    role: req.user.role
                }
            });

        } catch (error) {
            console.error(
                "ADD GALLERY ERROR:",
                error
            );

            res.status(500).json({
                success: false,
                message:
                    "Failed to add gallery item"
            });
        }
    }
);

app.delete(
    "/api/gallery/:id",
    verifyToken,
    async (req, res) => {
        try {
            const { id } = req.params;

            let result;

            if (req.user.role === "admin") {
                [result] =
                    await pool.query(
                        `
                        DELETE FROM gallery_photos
                        WHERE id = ?
                        `,
                        [id]
                    );
            } else {
                [result] =
                    await pool.query(
                        `
                        DELETE FROM gallery_photos
                        WHERE id = ?
                        AND user_id = ?
                        `,
                        [
                            id,
                            req.user.id
                        ]
                    );
            }

            if (result.affectedRows === 0) {
                return res.status(403).json({
                    success: false,
                    message:
                        "You do not have permission to delete this gallery item"
                });
            }

            res.json({
                success: true,
                message:
                    "Gallery item deleted successfully"
            });

        } catch (error) {
            console.error(
                "DELETE GALLERY ERROR:",
                error
            );

            res.status(500).json({
                success: false,
                message:
                    "Failed to delete gallery item"
            });
        }
    }
);

app.use((req, res) => {
    res.status(404).json({
        success: false,
        message:
            "API route not found"
    });
});

app.use((err, req, res, next) => {
    console.error(
        "SERVER ERROR:",
        err
    );

    res.status(500).json({
        success: false,
        message:
            "Internal server error"
    });
});

const PORT =
    process.env.PORT || 3000;

app.listen(
    PORT,
    () => {
        console.log(
            `Server running on port ${PORT}`
        );
    }
);