#!/usr/bin/env python3
"""
Setup script for TF Connect authentication provider for Synapse
"""

from setuptools import setup, find_packages

setup(
    name="synapse-tf-connect-auth",
    version="1.0.0",
    description="ThreeFold Connect authentication provider for Matrix Synapse",
    author="ThreeFold",
    author_email="info@threefold.io",
    url="https://github.com/threefoldtech/mycelium-chat",
    packages=find_packages(),
    py_modules=["synapse_tf_connect"],
    install_requires=[
        "pyyaml>=6.0",
        "requests>=2.31.0",
        "websocket-client>=1.6.0",
        "cryptography>=41.0.0",
        "pyjwt>=2.8.0",
        "redis>=4.6.0",
        "matrix-synapse>=1.90.0",
        "twisted>=22.10.0",
    ],
    python_requires=">=3.8",
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: System Administrators",
        "License :: OSI Approved :: Apache Software License",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Topic :: Communications :: Chat",
        "Topic :: System :: Systems Administration :: Authentication/Directory",
    ],
    entry_points={
        "synapse.modules": [
            "tf_connect = synapse_tf_connect:create_module",
        ],
    },
)
