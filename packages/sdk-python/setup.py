from setuptools import setup, find_packages

setup(
    name="psychosynth-sdk",
    version="0.1.0",
    description="Python SDK for the Psychosynth agent-native psychometric data marketplace",
    author="3esign",
    packages=find_packages(),
    install_requires=[
        "web3>=6.0.0",
        "eth-account>=0.10.0",
        "requests>=2.28.0",
    ],
    classifiers=[
        "Programming Language :: Python :: 3",
        "License :: OSI Approved :: MIT License",
    ],
)
