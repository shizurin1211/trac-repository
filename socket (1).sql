-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Servidor: 127.0.0.1
-- Tiempo de generación: 05-12-2025 a las 01:14:53
-- Versión del servidor: 10.4.32-MariaDB
-- Versión de PHP: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Base de datos: `socket`
--

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `ip_directions`
--

CREATE TABLE `ip_directions` (
  `ID` int(11) NOT NULL,
  `NAME` varchar(100) NOT NULL,
  `IP` varchar(15) NOT NULL,
  `PORT` int(11) NOT NULL,
  `CREATED_AT` timestamp NOT NULL DEFAULT current_timestamp(),
  `ID_NODE` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `ip_directions`
--

INSERT INTO `ip_directions` (`ID`, `NAME`, `IP`, `PORT`, `CREATED_AT`, `ID_NODE`) VALUES
(5, 'Servidor Web HTTP', '127.0.0.1', 80, '2025-12-05 00:05:32', 6),
(6, 'Servidor Web HTTPS', '127.0.0.1', 443, '2025-12-05 00:06:36', 6),
(7, 'Router Principal', '192.168.1.1', 80, '2025-12-05 00:08:41', 7),
(8, 'Servidor de Correo Local', '127.0.0.1', 25, '2025-12-05 00:12:00', 6);

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `nodes`
--

CREATE TABLE `nodes` (
  `ID` int(11) NOT NULL,
  `NAME` varchar(500) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `nodes`
--

INSERT INTO `nodes` (`ID`, `NAME`) VALUES
(6, 'Estación Habitación'),
(7, 'Estación Sala');

--
-- Índices para tablas volcadas
--

--
-- Indices de la tabla `ip_directions`
--
ALTER TABLE `ip_directions`
  ADD PRIMARY KEY (`ID`),
  ADD KEY `ID` (`ID_NODE`);

--
-- Indices de la tabla `nodes`
--
ALTER TABLE `nodes`
  ADD PRIMARY KEY (`ID`);

--
-- AUTO_INCREMENT de las tablas volcadas
--

--
-- AUTO_INCREMENT de la tabla `ip_directions`
--
ALTER TABLE `ip_directions`
  MODIFY `ID` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;

--
-- AUTO_INCREMENT de la tabla `nodes`
--
ALTER TABLE `nodes`
  MODIFY `ID` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=8;

--
-- Restricciones para tablas volcadas
--

--
-- Filtros para la tabla `ip_directions`
--
ALTER TABLE `ip_directions`
  ADD CONSTRAINT `ip_directions_ibfk_1` FOREIGN KEY (`ID_NODE`) REFERENCES `nodes` (`ID`) ON DELETE CASCADE ON UPDATE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
